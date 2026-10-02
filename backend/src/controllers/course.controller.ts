import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { CourseModel, type CourseDocument } from '../models/Course.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';
import { studentCounts } from '../utils/courseStats.js';
import { generateJoinCode } from '../utils/joinCode.js';
import {
  courseIdParamSchema,
  studentParamSchema,
  type CourseStatusInput,
  type CreateCourseInput,
  type JoinCourseInput,
  type UpdateCourseInput,
} from '../validators/course.schema.js';

const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;

// Finds the course in the URL if the logged-in user may manage it: its own
// instructor, or any admin. Someone else's course gives the same 404 as a
// course that doesn't exist, so instructors can't probe which ids exist.
// (Admins and instructors share these routes, and so one page in the UI.)
async function ownCourse(req: Request): Promise<CourseDocument> {
  const id = courseIdParamSchema.safeParse(req.params).data?.id;
  const filter = req.user!.role === 'admin' ? { _id: id } : { _id: id, instructor: req.user!.id };
  const course = id ? await CourseModel.findOne(filter) : null;
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

// Creates a course with a fresh join code. A new random code almost never
// collides (887 million possibilities), but if it does, the unique index
// rejects it and we simply try another one. Shared by instructors creating
// their own course and admins creating one for an instructor.
export async function insertCourse(
  fields: CreateCourseInput,
  instructorId: string,
): Promise<CourseDocument> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await CourseModel.create({ ...fields, instructor: instructorId, joinCode: generateJoinCode() });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error('Could not generate a unique join code');
}

// Only a course nobody ever joined can be deleted (e.g. created by mistake).
export const canDelete = (course: { hasHadStudents?: boolean | null }, studentCount: number) =>
  !course.hasHadStudents && studentCount === 0;

// GET /api/courses/mine : the instructor's courses, active first, newest first.
export async function listMyCourses(req: Request, res: Response) {
  const courses = await CourseModel.find({ instructor: req.user!.id }).sort({ status: 1, createdAt: -1 });
  const counts = await studentCounts(courses.map((c) => c._id));
  res.json({
    courses: courses.map((c) => {
      const studentCount = counts.get(c.id) ?? 0;
      return { ...c.toJSON(), studentCount, canDelete: canDelete(c, studentCount) };
    }),
  });
}

// GET /api/courses/:id : one of the instructor's own courses, with its count.
export async function getCourse(req: Request, res: Response) {
  const course = await ownCourse(req);
  const counts = await studentCounts([course._id]);
  // The admin's view of the page also shows who teaches the course.
  const instructor =
    req.user!.role === 'admin'
      ? await UserModel.findById(course.instructor).select('name email status')
      : null;
  res.json({
    course: {
      ...course.toJSON(),
      studentCount: counts.get(course.id) ?? 0,
      canDelete: canDelete(course, counts.get(course.id) ?? 0),
      ...(instructor
        ? { instructorInfo: { id: instructor.id, name: instructor.name, email: instructor.email, status: instructor.status } }
        : {}),
    },
  });
}

// POST /api/courses
export async function createCourse(req: Request, res: Response) {
  const course = await insertCourse(req.body as CreateCourseInput, req.user!.id);
  await audit(req.user!.id, 'course.created', null, { courseId: course.id, title: course.title });
  res.status(201).json({ course: course.toJSON(), message: `Course "${course.title}" created` });
}

// PATCH /api/courses/:id
export async function updateCourse(req: Request, res: Response) {
  const course = await ownCourse(req);
  const changes = req.body as UpdateCourseInput;
  course.set(changes);
  await course.save();
  res.json({ course: course.toJSON(), message: 'Course updated' });
}

// PATCH /api/courses/:id/status : archive or restore.
export async function setCourseStatus(req: Request, res: Response) {
  const { status } = req.body as CourseStatusInput;
  const course = await ownCourse(req);
  if (course.status === status) {
    throw ApiError.conflict(`This course is already ${status}`);
  }
  if (status === 'active' && course.archivedByAdmin) {
    throw ApiError.forbidden('An administrator archived this course. Contact them to restore it.');
  }
  course.status = status;
  course.archivedByAdmin = false;
  await course.save();
  await audit(req.user!.id, status === 'archived' ? 'course.archived' : 'course.restored', null, {
    courseId: course.id,
    title: course.title,
  });
  res.json({
    course: course.toJSON(),
    message:
      status === 'archived'
        ? `"${course.title}" archived. Students can no longer see or join it.`
        : `"${course.title}" restored`,
  });
}

// POST /api/courses/:id/join-code : new code; the old one stops working.
// Students already enrolled stay enrolled.
export async function regenerateJoinCode(req: Request, res: Response) {
  const course = await ownCourse(req);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      course.joinCode = generateJoinCode();
      await course.save();
      await audit(req.user!.id, 'course.code_reset', null, { courseId: course.id, title: course.title });
      res.json({ course: course.toJSON(), message: 'New join code created. The old code no longer works.' });
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error('Could not generate a unique join code');
}

// GET /api/courses/:id/students : the class list (owner only).
export async function listStudents(req: Request, res: Response) {
  const course = await ownCourse(req);
  const enrollments = await EnrollmentModel.find({ course: course._id })
    .sort({ joinedAt: -1 })
    .populate<{ student: { _id: Types.ObjectId; name: string; email: string; status?: string } | null }>(
      'student',
      'name email status',
    );
  res.json({
    students: enrollments
      .filter((e) => e.student) // skip enrolments whose user no longer exists
      .map((e) => ({
        id: String(e.student!._id),
        name: e.student!.name,
        email: e.student!.email,
        status: e.student!.status ?? 'active',
        joinedAt: e.joinedAt,
      })),
  });
}

// DELETE /api/courses/:id/students/:studentId : instructor removes a student.
export async function removeStudent(req: Request, res: Response) {
  const course = await ownCourse(req);
  // safeParse, not parse: a malformed id must be a clean 404, not a crash (500).
  const studentId = studentParamSchema.safeParse(req.params).data?.studentId;
  const removed = studentId
    ? await EnrollmentModel.findOneAndDelete({ course: course._id, student: studentId })
    : null;
  if (!removed) throw ApiError.notFound('This student is not in the course');
  await audit(req.user!.id, 'course.student_removed', removed.student, { courseId: course.id, title: course.title });
  res.json({ message: 'Student removed from the course' });
}

// What a student may see about a course: no join code, no other students.
function studentView(course: CourseDocument, instructorName: string, joinedAt: Date) {
  return {
    id: course.id,
    title: course.title,
    code: course.code,
    description: course.description,
    instructorName,
    joinedAt,
  };
}

// POST /api/courses/join  { code }  (students)
// Wrong code and archived course get the same answer, so codes of archived
// courses can't be discovered.
export async function joinCourse(req: Request, res: Response) {
  const { code } = req.body as JoinCourseInput;
  const course = await CourseModel.findOne({ joinCode: code, status: 'active' }).populate<{
    instructor: { name: string } | null;
  }>('instructor', 'name');
  if (!course) throw ApiError.notFound('No course found with that code. Check it with your instructor.');

  try {
    const enrollment = await EnrollmentModel.create({ course: course._id, student: req.user!.id });
    // Remember forever that this course has had students: it can no longer be deleted.
    if (!course.hasHadStudents) await CourseModel.updateOne({ _id: course._id }, { hasHadStudents: true });
    res.status(201).json({
      course: studentView(course as unknown as CourseDocument, course.instructor?.name ?? 'Instructor', enrollment.joinedAt),
      message: `You joined "${course.title}"`,
    });
  } catch (err) {
    // Unique (course, student) index: already a member.
    if (isDuplicateKey(err)) throw ApiError.conflict(`You're already in "${course.title}"`);
    throw err;
  }
}

// GET /api/courses/enrolled : the student's courses (active ones only).
export async function listEnrolledCourses(req: Request, res: Response) {
  const enrollments = await EnrollmentModel.find({ student: req.user!.id })
    .sort({ joinedAt: -1 })
    .populate<{ course: (CourseDocument & { instructor: { name: string } | null }) | null }>({
      path: 'course',
      populate: { path: 'instructor', select: 'name' },
    });
  res.json({
    courses: enrollments
      .filter((e) => e.course && e.course.status === 'active') // archived courses are hidden
      .map((e) => studentView(e.course!, e.course!.instructor?.name ?? 'Instructor', e.joinedAt)),
  });
}

// DELETE /api/courses/:id/enrollment : the student leaves a course.
export async function leaveCourse(req: Request, res: Response) {
  const id = courseIdParamSchema.safeParse(req.params).data?.id;
  const removed = id ? await EnrollmentModel.findOneAndDelete({ course: id, student: req.user!.id }) : null;
  if (!removed) throw ApiError.notFound("You're not in this course");
  res.json({ message: 'You left the course' });
}

// DELETE /api/courses/:id : only for a course nobody ever joined (its own
// instructor or an admin). Anything with history must be archived instead.
export async function deleteCourse(req: Request, res: Response) {
  const course = await ownCourse(req);
  const count = (await studentCounts([course._id])).get(course.id) ?? 0;
  if (!canDelete(course, count)) {
    throw ApiError.conflict('Students have joined this course, so it can only be archived, not deleted.');
  }
  // Delete only if still never joined: a student joining at this very moment
  // makes the delete match nothing instead of removing a course in use.
  const deleted = await CourseModel.findOneAndDelete({ _id: course._id, hasHadStudents: false });
  if (!deleted) throw ApiError.conflict('Someone just joined this course, so it can only be archived.');
  await audit(req.user!.id, 'course.deleted', null, { courseId: course.id, title: course.title });
  res.json({ message: `"${course.title}" deleted` });
}
