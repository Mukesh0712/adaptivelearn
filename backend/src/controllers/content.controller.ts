import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Types } from 'mongoose';
import { CourseModel, type CourseDocument } from '../models/Course.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { LessonModel, MAX_RESOURCES } from '../models/Lesson.js';
import { LessonProgressModel } from '../models/LessonProgress.js';
import { ModuleModel } from '../models/Module.js';
import { QuizModel } from '../models/Quiz.js';
import { finishedLessons } from '../utils/progress.js';
import { studentQuizSummaries } from './attempt.controller.js';
import { ApiError } from '../utils/ApiError.js';
import { checkFile, cleanFileName, MAX_FILE_BYTES } from '../utils/fileTypes.js';
import { deleteStoredFiles, fetchStoredFile, storageEnabled, StorageError, storeFile } from '../utils/fileStorage.js';
import { parseVideoUrl, recordingPlatform } from '../utils/videoUrl.js';
import {
  contentParamsSchema,
  type ModuleInput,
  type NewResourceInput,
  type NewLessonInput,
  type OrderInput,
  type ProgressInput,
  type UpdateLessonInput,
} from '../validators/content.schema.js';

export interface Access {
  course: CourseDocument;
  canEdit: boolean; // the course's instructor, or an admin
}

const params = (req: Request) => {
  const p = contentParamsSchema.safeParse(req.params);
  if (!p.success) throw ApiError.notFound('Not found');
  return p.data;
};

// Who may do what with a course's content. Checked on EVERY content request:
//  - its instructor and admins: everything (including drafts);
//  - an enrolled student: read published lessons of an active course;
//  - anyone else: 404, the same as a course that doesn't exist.
export async function courseAccess(req: Request): Promise<Access> {
  const { courseId } = params(req);
  const course = await CourseModel.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');
  const { id, role } = req.user!;
  if (role === 'admin' || (role === 'instructor' && String(course.instructor) === id)) {
    return { course, canEdit: true };
  }
  if (role === 'student' && course.status === 'active' && (await EnrollmentModel.exists({ course: course._id, student: id }))) {
    return { course, canEdit: false };
  }
  throw ApiError.notFound('Course not found');
}

export async function editAccess(req: Request): Promise<Access> {
  const access = await courseAccess(req);
  if (!access.canEdit) throw ApiError.forbidden('Only the course instructor can change its content');
  return access;
}

// A module of THIS course (an id from another course gives 404).
async function moduleIn(course: CourseDocument, moduleId?: string) {
  const mod = moduleId ? await ModuleModel.findOne({ _id: moduleId, course: course._id }) : null;
  if (!mod) throw ApiError.notFound('Module not found');
  return mod;
}

// The course outline in reading order: modules by position, lessons by
// position. Students only ever get published lessons.
// keep: module ids to show even with no published lessons (e.g. they have
// a published quiz).
async function outline(courseId: Types.ObjectId, publishedOnly: boolean, keep: Set<string> = new Set()) {
  const [modules, lessons] = await Promise.all([
    ModuleModel.find({ course: courseId }).sort({ position: 1, _id: 1 }),
    LessonModel.find({ course: courseId, ...(publishedOnly ? { status: 'published' } : {}) })
      .select('title module position status publishedAt')
      .sort({ position: 1, _id: 1 }),
  ]);
  return modules
    .map((m) => ({
      id: m.id,
      title: m.title,
      lessons: lessons
        .filter((l) => String(l.module) === m.id)
        .map((l) => ({ id: l.id, title: l.title, status: l.status })),
    }))
    // Students don't see empty modules (e.g. only drafts so far).
    .filter((m) => !publishedOnly || m.lessons.length > 0 || keep.has(m.id));
}

// GET /api/courses/:courseId/content
export async function getContent(req: Request, res: Response) {
  const { course, canEdit } = await courseAccess(req);
  if (canEdit) {
    const [modules, quizzes] = await Promise.all([
      outline(course._id, false),
      // Editors also see each module's quizzes (drafts included).
      QuizModel.find({ course: course._id, module: { $ne: null } })
        .sort({ createdAt: 1, _id: 1 })
        .select('title module status kind'),
    ]);
    res.json({
      course: courseSummary(course),
      canEdit,
      modules: modules.map((m) => ({
        ...m,
        quizzes: quizzes
          .filter((q) => String(q.module) === m.id)
          .map((q) => ({ id: q.id, title: q.title, status: q.status, kind: q.kind })),
      })),
    });
    return;
  }
  // Students: published lessons (with the ones they've finished) and the
  // published quizzes, inside their module or as course tests, with their
  // best score. A module with only a quiz so far is still shown.
  const [finished, quizzes] = await Promise.all([
    finishedLessons(req.user!.id, course._id),
    studentQuizSummaries(course._id, req.user!.id),
  ]);
  const modules = await outline(course._id, true, new Set(quizzes.flatMap((q) => (q.module ? [q.module] : []))));
  const withDone = modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({ ...l, done: finished.has(l.id) })),
    quizzes: quizzes.filter((q) => q.module === m.id),
  }));
  const total = withDone.reduce((n, m) => n + m.lessons.length, 0);
  const done = withDone.reduce((n, m) => n + m.lessons.filter((l) => l.done).length, 0);
  res.json({
    course: courseSummary(course),
    canEdit,
    modules: withDone,
    courseTests: quizzes.filter((q) => !q.module),
    progress: { done, total },
  });
}

const courseSummary = (course: CourseDocument) => ({
  id: course.id,
  title: course.title,
  code: course.code,
  status: course.status,
});

// Upper limits: generous for a semester, and they keep every list short
// enough to load at once and reorder in one request (the order schema
// accepts at most 500 ids).
const MAX_MODULES = 100;
const MAX_LESSONS_PER_MODULE = 100;

// POST /api/courses/:courseId/modules  { title }
export async function createModule(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const { title } = req.body as ModuleInput;
  const position = await ModuleModel.countDocuments({ course: course._id }); // goes to the end
  if (position >= MAX_MODULES) throw ApiError.conflict(`A course can have at most ${MAX_MODULES} modules.`);
  const mod = await ModuleModel.create({ course: course._id, title, position });
  res.status(201).json({ module: { id: mod.id, title: mod.title }, message: `Module "${mod.title}" added` });
}

// PATCH /api/courses/:courseId/modules/:moduleId  { title }
export async function renameModule(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const mod = await moduleIn(course, params(req).moduleId);
  mod.title = (req.body as ModuleInput).title;
  await mod.save();
  res.json({ message: 'Module renamed' });
}

// DELETE /api/courses/:courseId/modules/:moduleId : only an EMPTY module,
// so lessons are never deleted by accident along with their module.
export async function deleteModule(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const mod = await moduleIn(course, params(req).moduleId);
  const [lessons, quizzes] = await Promise.all([
    LessonModel.countDocuments({ module: mod._id }),
    QuizModel.countDocuments({ module: mod._id }),
  ]);
  if (lessons > 0 || quizzes > 0) {
    const parts = [
      lessons ? `${lessons} lesson${lessons === 1 ? '' : 's'}` : '',
      quizzes ? `${quizzes} quiz${quizzes === 1 ? '' : 'zes'}` : '',
    ].filter(Boolean);
    throw ApiError.conflict(`"${mod.title}" still has ${parts.join(' and ')}. Delete or move them first.`);
  }
  await mod.deleteOne();
  // Close the gap so positions stay 0, 1, 2…
  await ModuleModel.updateMany({ course: course._id, position: { $gt: mod.position } }, { $inc: { position: -1 } });
  res.json({ message: `Module "${mod.title}" deleted` });
}

// Applies a new order. The list must contain exactly the current items
// (no more, no fewer): if someone added or removed one meanwhile, the
// request is refused instead of silently mis-ordering.
async function applyOrder(
  modelName: 'module' | 'lesson',
  current: { _id: Types.ObjectId }[],
  ids: string[],
) {
  const have = new Set(current.map((d) => String(d._id)));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) {
    throw ApiError.conflict('The list changed since you loaded it. Refresh and try again.');
  }
  const Model = modelName === 'module' ? ModuleModel : LessonModel;
  // One round trip for all the updates.
  await (Model as typeof ModuleModel).bulkWrite(
    ids.map((id, position) => ({ updateOne: { filter: { _id: id }, update: { position } } })),
  );
}

// PUT /api/courses/:courseId/modules/order  { ids }
export async function reorderModules(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const current = await ModuleModel.find({ course: course._id }).select('_id');
  await applyOrder('module', current, (req.body as OrderInput).ids);
  res.json({ message: 'Order saved' });
}

// POST /api/courses/:courseId/modules/:moduleId/lessons  { title } : a new draft.
export async function createLesson(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const mod = await moduleIn(course, params(req).moduleId);
  const position = await LessonModel.countDocuments({ module: mod._id });
  if (position >= MAX_LESSONS_PER_MODULE) {
    throw ApiError.conflict(`A module can have at most ${MAX_LESSONS_PER_MODULE} lessons. Start a new module.`);
  }
  const lesson = await LessonModel.create({
    course: course._id,
    module: mod._id,
    title: (req.body as NewLessonInput).title,
    position,
  });
  res.status(201).json({ lesson: lesson.toJSON(), message: `Lesson "${lesson.title}" created as a draft` });
}

// PUT /api/courses/:courseId/modules/:moduleId/lessons/order  { ids }
export async function reorderLessons(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const mod = await moduleIn(course, params(req).moduleId);
  const current = await LessonModel.find({ module: mod._id }).select('_id');
  await applyOrder('lesson', current, (req.body as OrderInput).ids);
  res.json({ message: 'Order saved' });
}

// A lesson of THIS course. Students: only published ones (a draft gives 404).
async function lessonIn(req: Request, access: Access) {
  const { lessonId } = params(req);
  const lesson = lessonId
    ? await LessonModel.findOne({
        _id: lessonId,
        course: access.course._id,
        ...(access.canEdit ? {} : { status: 'published' }),
      })
    : null;
  if (!lesson) throw ApiError.notFound('Lesson not found');
  return lesson;
}

// GET /api/courses/:courseId/lessons/:lessonId : the lesson, plus the
// previous/next lesson in reading order (for the reader's navigation).
export async function getLesson(req: Request, res: Response) {
  const access = await courseAccess(req);
  const lesson = await lessonIn(req, access);
  const modules = await outline(access.course._id, !access.canEdit);
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const i = flat.findIndex((l) => l.id === lesson.id);
  const moduleTitle = modules.find((m) => m.id === String(lesson.module))?.title ?? '';
  const done = access.canEdit
    ? undefined
    : !!(await LessonProgressModel.exists({ lesson: lesson._id, student: req.user!.id }));
  res.json({
    lesson: { ...lesson.toJSON(), moduleTitle },
    course: { id: access.course.id, title: access.course.title },
    canEdit: access.canEdit,
    ...(done === undefined ? {} : { done }),
    previous: i > 0 ? { id: flat[i - 1]!.id, title: flat[i - 1]!.title } : null,
    next: i >= 0 && i < flat.length - 1 ? { id: flat[i + 1]!.id, title: flat[i + 1]!.title } : null,
  });
}

// PATCH /api/courses/:courseId/lessons/:lessonId  { title?, content?, status? }
export async function updateLesson(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  const changes = req.body as UpdateLessonInput;
  const publishing = changes.status === 'published' && lesson.status !== 'published';
  lesson.set(changes);
  if (publishing) lesson.publishedAt = new Date();
  await lesson.save();
  res.json({
    lesson: lesson.toJSON(),
    message: publishing
      ? 'Lesson published. Students can see it now.'
      : changes.status === 'draft'
        ? 'Lesson moved back to draft. Students no longer see it.'
        : 'Lesson saved',
  });
}

// DELETE /api/courses/:courseId/lessons/:lessonId
export async function deleteLesson(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  await lesson.deleteOne();
  await Promise.all([
    deleteStoredFiles(storedIds(lesson.resources)),
    LessonProgressModel.deleteMany({ lesson: lesson._id }),
  ]);
  // Close the gap so positions stay 0, 1, 2…
  await LessonModel.updateMany({ module: lesson.module, position: { $gt: lesson.position } }, { $inc: { position: -1 } });
  res.json({ message: `Lesson "${lesson.title}" deleted` });
}

// POST /api/courses/:courseId/lessons/:lessonId/resources  { kind, url, title? }
// Saved straight away (not with the lesson text), like file uploads later.
export async function addResource(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  if (lesson.resources.length >= MAX_RESOURCES) {
    throw ApiError.conflict(`A lesson can have at most ${MAX_RESOURCES} videos, links and files.`);
  }
  const input = req.body as NewResourceInput;
  const { kind, url, title } = input;
  // The validator already checked the video link, so this always succeeds.
  const video = kind === 'video' ? parseVideoUrl(url) : null;
  const passcode = input.kind === 'link' && input.passcode ? input.passcode : undefined;
  lesson.resources.push({ kind, url, title, ...video, ...(passcode ? { passcode } : {}) });
  await lesson.save();
  const added = lesson.toJSON().resources.at(-1);
  const message = kind === 'video' ? 'Video added' : recordingPlatform(url) ? 'Recording link added' : 'Link added';
  res.status(201).json({ resource: added, message });
}

// DELETE /api/courses/:courseId/lessons/:lessonId/resources/:resourceId
export async function deleteResource(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  const { resourceId } = params(req);
  const resource = resourceId ? lesson.resources.id(resourceId) : null;
  if (!resource) throw ApiError.notFound('That video or link was already removed');
  const { kind, publicId } = resource;
  resource.deleteOne();
  await lesson.save();
  if (publicId) await deleteStoredFiles([publicId]);
  res.json({ message: kind === 'video' ? 'Video removed' : kind === 'file' ? 'File removed' : 'Link removed' });
}

// PUT /api/courses/:courseId/lessons/:lessonId/resources/order  { ids }
export async function reorderResources(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  const { ids } = req.body as OrderInput;
  const have = new Set(lesson.resources.map((r) => String(r._id)));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) {
    throw ApiError.conflict('The list changed since you loaded it. Refresh and try again.');
  }
  const byId = new Map(lesson.resources.map((r) => [String(r._id), r.toObject()]));
  lesson.set('resources', ids.map((id) => byId.get(id)));
  await lesson.save();
  res.json({ message: 'Order saved' });
}

// The Cloudinary names of a lesson's files (used when deleting).
export const storedIds = (resources: { publicId?: string | null }[]) =>
  resources.flatMap((r) => (r.publicId ? [r.publicId] : []));

// Reads one uploaded file into memory (at most 10 MB, so that's fine).
// defParamCharset utf8: keeps non-English file names (e.g. "नोट्स.pdf") intact.
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, fieldSize: 1000 },
  defParamCharset: 'utf8',
}).single('file');

function receiveFile(req: Request, res: Response): Promise<Express.Multer.File> {
  return new Promise((resolve, reject) => {
    receive(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return reject(
          err.code === 'LIMIT_FILE_SIZE'
            ? new ApiError(413, 'The file is larger than 10 MB.')
            : ApiError.badRequest('Send one file in a field named "file".'),
        );
      }
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      if (!req.file) return reject(ApiError.badRequest('Choose a file to upload.'));
      resolve(req.file);
    });
  });
}

const fileTitleSchema = z.object({ title: z.string().trim().max(150, 'Title must be at most 150 characters').default('') });

// POST /api/courses/:courseId/lessons/:lessonId/files  (multipart: file, title?)
// Who may upload is checked BEFORE the file is read, so nobody else can
// make the server receive 10 MB.
export async function uploadResourceFile(req: Request, res: Response) {
  if (!storageEnabled) {
    throw new ApiError(503, 'File uploads are not set up on this server yet (Cloudinary keys are missing).');
  }
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  if (lesson.resources.length >= MAX_RESOURCES) {
    throw ApiError.conflict(`A lesson can have at most ${MAX_RESOURCES} videos, links and files.`);
  }
  const file = await receiveFile(req, res);
  const fields = fileTitleSchema.safeParse(req.body ?? {});
  if (!fields.success) throw ApiError.badRequest('Validation failed', z.flattenError(fields.error).fieldErrors);
  const type = checkFile(file.originalname, file.buffer);
  if ('error' in type) throw ApiError.badRequest(type.error, { file: [type.error] });

  // A random name in storage: the uploader's file name never becomes part
  // of a storage path. The real name is kept for display and download.
  const stored = await storeFile(file.buffer, `adaptivelearn/${access.course.id}/${randomUUID()}.${type.ext}`).catch(
    (err: unknown) => {
      // The full reason goes to the server log (for the administrator);
      // the user gets a plain message without account details.
      const e = err instanceof StorageError ? err : new StorageError(String(err));
      console.error(`Storage: upload failed (${e.httpCode ?? 'no HTTP status'}): ${e.message}`);
      console.error('  Check the CLOUDINARY_* settings, or run: npm run check:storage');
      throw new ApiError(502, 'The file could not be saved to storage. Please try again in a moment.');
    },
  );
  try {
    lesson.resources.push({
      kind: 'file',
      title: fields.data.title,
      fileName: cleanFileName(file.originalname, type.ext),
      size: file.size,
      mimeType: type.mime,
      publicId: stored.publicId,
    });
    await lesson.save();
  } catch (err) {
    await deleteStoredFiles([stored.publicId]); // don't leave an unused file behind
    throw err;
  }
  res.status(201).json({ resource: lesson.toJSON().resources.at(-1), message: 'File uploaded' });
}

// GET /api/courses/:courseId/lessons/:lessonId/resources/:resourceId/file
// Same access rule as the lesson itself (students: published lessons only).
export async function downloadResourceFile(req: Request, res: Response) {
  const access = await courseAccess(req);
  const lesson = await lessonIn(req, access);
  const { resourceId } = params(req);
  const resource = resourceId ? lesson.resources.id(resourceId) : null;
  if (!resource || resource.kind !== 'file' || !resource.publicId) throw ApiError.notFound('File not found');
  if (!storageEnabled) throw new ApiError(503, 'File downloads are not set up on this server yet.');

  const upstream = await fetchStoredFile(resource.publicId).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    console.error(`Storage: could not fetch ${resource.publicId} (${upstream?.status ?? 'network error'})`);
    throw new ApiError(502, 'The file could not be fetched right now. Please try again.');
  }
  // Our own type (from the allow-list), not the stored one, and always
  // "attachment": the browser saves the file instead of opening it here.
  // attachment() also guesses a type from the file name, so ours is set after it.
  res.attachment(resource.fileName ?? 'file');
  res.type(resource.mimeType ?? 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) res.set('Content-Length', length);
  // Stream it through without holding the whole file in memory. If
  // Cloudinary drops the connection halfway, end ours too (the browser then
  // reports a failed download instead of saving half a file).
  Readable.fromWeb(upstream.body as WebReadableStream)
    .on('error', () => res.destroy())
    .pipe(res);
}

// PUT /api/courses/:courseId/lessons/:lessonId/progress  { done }
// Students only, for a published lesson of a course they're in (the same
// access rule as reading it). Safe to repeat: marking done twice is a no-op.
export async function setProgress(req: Request, res: Response) {
  if (req.user!.role !== 'student') throw ApiError.forbidden('Only students track their progress');
  const access = await courseAccess(req);
  const lesson = await lessonIn(req, access);
  const { done } = req.body as ProgressInput;
  const key = { lesson: lesson._id, student: req.user!.id };
  if (done) {
    try {
      await LessonProgressModel.updateOne(
        key,
        { $setOnInsert: { course: access.course._id, completedAt: new Date() } },
        { upsert: true },
      );
    } catch (err) {
      // Two clicks at the same moment: the unique index stopped the second. Fine.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  } else {
    await LessonProgressModel.deleteOne(key);
  }
  res.json({ done, message: done ? 'Marked as done' : 'Marked as not done' });
}

