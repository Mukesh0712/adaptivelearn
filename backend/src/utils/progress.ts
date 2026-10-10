import type { Types } from 'mongoose';
import { LessonModel } from '../models/Lesson.js';
import { LessonProgressModel } from '../models/LessonProgress.js';

// Progress counts PUBLISHED lessons only: a lesson moved back to draft (or
// deleted) stops counting, and a newly published one is added to the total.
export interface Progress {
  done: number;
  total: number;
}

type Id = Types.ObjectId | string;

async function publishedLessons(courseIds: Id[]) {
  return LessonModel.find({ course: { $in: courseIds }, status: 'published' }).select('_id course');
}

// One student, several courses (the student's "My courses").
export async function studentProgress(studentId: Id, courseIds: Id[]): Promise<Map<string, Progress>> {
  const lessons = await publishedLessons(courseIds);
  const finished = await LessonProgressModel.find({ student: studentId, lesson: { $in: lessons.map((l) => l._id) } }).select('lesson');
  const doneLessons = new Set(finished.map((p) => String(p.lesson)));
  const result = new Map<string, Progress>(courseIds.map((id) => [String(id), { done: 0, total: 0 }]));
  for (const l of lessons) {
    const p = result.get(String(l.course))!;
    p.total++;
    if (doneLessons.has(String(l._id))) p.done++;
  }
  return result;
}

// One course, every student (the instructor's class list).
export async function classProgress(courseId: Id): Promise<{ total: number; done: Map<string, number> }> {
  const lessons = await publishedLessons([courseId]);
  const finished = await LessonProgressModel.find({ course: courseId, lesson: { $in: lessons.map((l) => l._id) } }).select('student');
  const done = new Map<string, number>();
  for (const p of finished) done.set(String(p.student), (done.get(String(p.student)) ?? 0) + 1);
  return { total: lessons.length, done };
}

// Which of these lessons one student has finished.
export async function finishedLessons(studentId: Id, courseId: Id): Promise<Set<string>> {
  const rows = await LessonProgressModel.find({ course: courseId, student: studentId }).select('lesson');
  return new Set(rows.map((r) => String(r.lesson)));
}
