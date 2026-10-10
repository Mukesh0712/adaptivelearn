import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { CourseModel, type CourseDocument } from '../models/Course.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { LessonModel, MAX_RESOURCES } from '../models/Lesson.js';
import { ModuleModel } from '../models/Module.js';
import { ApiError } from '../utils/ApiError.js';
import { parseVideoUrl } from '../utils/videoUrl.js';
import {
  contentParamsSchema,
  type ModuleInput,
  type NewResourceInput,
  type NewLessonInput,
  type OrderInput,
  type UpdateLessonInput,
} from '../validators/content.schema.js';

interface Access {
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
async function courseAccess(req: Request): Promise<Access> {
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

async function editAccess(req: Request): Promise<Access> {
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
async function outline(courseId: Types.ObjectId, publishedOnly: boolean) {
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
    .filter((m) => !publishedOnly || m.lessons.length > 0);
}

// GET /api/courses/:courseId/content
export async function getContent(req: Request, res: Response) {
  const { course, canEdit } = await courseAccess(req);
  res.json({
    course: { id: course.id, title: course.title, code: course.code, status: course.status },
    canEdit,
    modules: await outline(course._id, !canEdit),
  });
}

// POST /api/courses/:courseId/modules  { title }
export async function createModule(req: Request, res: Response) {
  const { course } = await editAccess(req);
  const { title } = req.body as ModuleInput;
  const position = await ModuleModel.countDocuments({ course: course._id }); // goes to the end
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
  const lessons = await LessonModel.countDocuments({ module: mod._id });
  if (lessons > 0) {
    throw ApiError.conflict(`"${mod.title}" still has ${lessons} lesson${lessons === 1 ? '' : 's'}. Delete them first.`);
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
  res.json({
    lesson: { ...lesson.toJSON(), moduleTitle },
    course: { id: access.course.id, title: access.course.title },
    canEdit: access.canEdit,
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
    throw ApiError.conflict(`A lesson can have at most ${MAX_RESOURCES} videos and links.`);
  }
  const { kind, url, title } = req.body as NewResourceInput;
  // The validator already checked the video link, so this always succeeds.
  const video = kind === 'video' ? parseVideoUrl(url) : null;
  lesson.resources.push({ kind, url, title, ...video });
  await lesson.save();
  const added = lesson.toJSON().resources.at(-1);
  res.status(201).json({ resource: added, message: kind === 'video' ? 'Video added' : 'Link added' });
}

// DELETE /api/courses/:courseId/lessons/:lessonId/resources/:resourceId
export async function deleteResource(req: Request, res: Response) {
  const access = await editAccess(req);
  const lesson = await lessonIn(req, access);
  const { resourceId } = params(req);
  const resource = resourceId ? lesson.resources.id(resourceId) : null;
  if (!resource) throw ApiError.notFound('That video or link was already removed');
  const kind = resource.kind;
  resource.deleteOne();
  await lesson.save();
  res.json({ message: kind === 'video' ? 'Video removed' : 'Link removed' });
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
