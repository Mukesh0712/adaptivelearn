import type { Request, Response } from 'express';
import { CourseModel, type CourseDocument } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { generateJoinCode } from '../utils/joinCode.js';
import {
  courseIdParamSchema,
  type CourseStatusInput,
  type CreateCourseInput,
  type UpdateCourseInput,
} from '../validators/course.schema.js';

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
  res.json({ courses: courses.map((c) => c.toJSON()) });
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
      const duplicateCode =
        typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
      if (!duplicateCode) throw err;
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
