import type { Request, Response } from 'express';
import type { QueryFilter, Types } from 'mongoose';
import { CourseModel, type Course } from '../models/Course.js';
import { UserModel } from '../models/User.js';
import { canDelete, insertCourse } from './course.controller.js';
import { parseOrThrow } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';
import { studentCounts } from '../utils/courseStats.js';
import { escapeRegex } from '../utils/regex.js';
import {
  listCoursesQuerySchema,
  type AdminCreateCourseInput,
  type ReassignCourseInput,
} from '../validators/admin.schema.js';
import { courseIdParamSchema, type CourseStatusInput } from '../validators/course.schema.js';

type Instructor = { _id: Types.ObjectId; name: string; email: string } | null;

// GET /api/admin/courses : every course, newest first, with its instructor
// and student count. Search matches the title or the course code.
export async function listAllCourses(req: Request, res: Response) {
  const { q, status, page, pageSize } = parseOrThrow(listCoursesQuerySchema, req.query);

  const filter: QueryFilter<Course> = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { code: pattern }];
  }
  if (status) filter.status = status;

  const [courses, total] = await Promise.all([
    CourseModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate<{ instructor: Instructor }>('instructor', 'name email'),
    CourseModel.countDocuments(filter),
  ]);
  const counts = await studentCounts(courses.map((c) => c._id));

  res.json({
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      code: c.code,
      status: c.status,
      archivedByAdmin: c.archivedByAdmin,
      instructor: c.instructor ? { id: String(c.instructor._id), name: c.instructor.name, email: c.instructor.email } : null,
      studentCount: counts.get(c.id) ?? 0,
      canDelete: canDelete(c, counts.get(c.id) ?? 0),
      createdAt: c.get('createdAt'),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

// PATCH /api/admin/courses/:id/status : archive or restore any course.
// An admin-archived course can't be restored by its instructor.
export async function setAnyCourseStatus(req: Request, res: Response) {
  const { status } = req.body as CourseStatusInput;
  const id = courseIdParamSchema.safeParse(req.params).data?.id;
  const course = id ? await CourseModel.findById(id) : null;
  if (!course) throw ApiError.notFound('Course not found');
  if (course.status === status) throw ApiError.conflict(`This course is already ${status}`);

  course.status = status;
  course.archivedByAdmin = status === 'archived';
  await course.save();
  await audit(req.user!.id, status === 'archived' ? 'course.archived' : 'course.restored', null, {
    courseId: course.id,
    title: course.title,
    byAdmin: true,
  });
  res.json({
    message:
      status === 'archived'
        ? `"${course.title}" archived. Its instructor can't restore it; only an admin can.`
        : `"${course.title}" restored`,
  });
}

// The instructor a course is given to must be an active instructor account.
async function activeInstructor(id: string) {
  const user = await UserModel.findById(id);
  if (!user || user.role !== 'instructor' || (user.status && user.status !== 'active')) {
    throw ApiError.badRequest('Choose an active instructor', { instructorId: ['Choose an active instructor'] });
  }
  return user;
}

// POST /api/admin/courses : create a course on an instructor's behalf.
export async function createCourseFor(req: Request, res: Response) {
  const { instructorId, ...fields } = req.body as AdminCreateCourseInput;
  const instructor = await activeInstructor(instructorId);
  const course = await insertCourse(fields, instructor.id);
  await audit(req.user!.id, 'course.created', null, {
    courseId: course.id,
    title: course.title,
    byAdmin: true,
    instructorName: instructor.name,
  });
  res.status(201).json({
    course: course.toJSON(),
    message: `Course "${course.title}" created for ${instructor.name}`,
  });
}

// PATCH /api/admin/courses/:id/instructor : e.g. when a teacher leaves.
// Students, join code and everything else stay as they are.
export async function reassignCourse(req: Request, res: Response) {
  const { instructorId } = req.body as ReassignCourseInput;
  const id = courseIdParamSchema.safeParse(req.params).data?.id;
  const course = id ? await CourseModel.findById(id).populate<{ instructor: Instructor }>('instructor', 'name email') : null;
  if (!course) throw ApiError.notFound('Course not found');
  if (course.instructor && String(course.instructor._id) === instructorId) {
    throw ApiError.badRequest(`${course.instructor.name} already teaches this course`, {
      instructorId: ['This instructor already teaches this course'],
    });
  }
  const next = await activeInstructor(instructorId);
  const from = course.instructor?.name ?? 'No instructor';

  await CourseModel.updateOne({ _id: course._id }, { instructor: next._id });
  await audit(req.user!.id, 'course.reassigned', null, {
    courseId: course.id,
    title: course.title,
    from,
    to: next.name,
  });
  res.json({ message: `"${course.title}" now belongs to ${next.name}` });
}
