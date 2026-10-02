import type { Request, Response } from 'express';
import type { QueryFilter, Types } from 'mongoose';
import { CourseModel, type Course } from '../models/Course.js';
import { parseOrThrow } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';
import { studentCounts } from '../utils/courseStats.js';
import { escapeRegex } from '../utils/regex.js';
import { listCoursesQuerySchema } from '../validators/admin.schema.js';
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
