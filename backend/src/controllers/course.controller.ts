import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { CourseModel, type CourseDocument } from '../models/Course.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { ApiError } from '../utils/ApiError.js';
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

// Number of students in each of the given courses, in ONE database query
// (an aggregation grouping enrolments by course), not one query per course.
async function studentCounts(courseIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await EnrollmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

// Finds a course owned by the logged-in instructor. Someone else's course
// gives the same 404 as a course that doesn't exist, so instructors can't
// probe which course ids exist.
async function ownCourse(req: Request): Promise<CourseDocument> {
  const id = courseIdParamSchema.safeParse(req.params).data?.id;
  const course = id ? await CourseModel.findOne({ _id: id, instructor: req.user!.id }) : null;
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

// GET /api/courses/mine : the instructor's courses, active first, newest first.
export async function listMyCourses(req: Request, res: Response) {
  const courses = await CourseModel.find({ instructor: req.user!.id }).sort({ status: 1, createdAt: -1 });
  const counts = await studentCounts(courses.map((c) => c._id));
  res.json({ courses: courses.map((c) => ({ ...c.toJSON(), studentCount: counts.get(c.id) ?? 0 })) });
}

// GET /api/courses/:id : one of the instructor's own courses, with its count.
export async function getCourse(req: Request, res: Response) {
  const course = await ownCourse(req);
  const counts = await studentCounts([course._id]);
  res.json({ course: { ...course.toJSON(), studentCount: counts.get(course.id) ?? 0 } });
}

// POST /api/courses
export async function createCourse(req: Request, res: Response) {
  const { title, code, description } = req.body as CreateCourseInput;

  // A new random code almost never collides (887 million possibilities), but
  // if it does, the unique index rejects it and we simply try another one.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const course = await CourseModel.create({
        title,
        code,
        description,
        instructor: req.user!.id,
        joinCode: generateJoinCode(),
      });
      res.status(201).json({ course: course.toJSON(), message: `Course "${course.title}" created` });
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error('Could not generate a unique join code');
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
  course.status = status;
  await course.save();
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
  const { studentId } = studentParamSchema.parse(req.params);
  const removed = await EnrollmentModel.findOneAndDelete({ course: course._id, student: studentId });
  if (!removed) throw ApiError.notFound('This student is not in the course');
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
