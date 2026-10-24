import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { LessonModel } from '../models/Lesson.js';
import { QuizModel } from '../models/Quiz.js';
import { QuizAttemptModel } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { aiRequest } from '../utils/aiClient.js';
import { withAiRequest } from '../utils/aiQuota.js';
import { contentParamsSchema } from '../validators/content.schema.js';
import type { LessonChatInput } from '../validators/ai.schema.js';
import { courseAccess } from './content.controller.js';

const chatSchema = z.object({ answer: z.string().min(1).max(4000), model: z.string() });
// Too little text to answer questions from.
const MIN_LESSON_CHARS = 100;

// Is the student in the middle of a GRADED test in this course? (An
// attempt whose time ran out doesn't count, even if not yet finalised.)
async function takingGradedTest(courseId: Types.ObjectId, studentId: string) {
  const graded = await QuizModel.find({ course: courseId, kind: 'graded' }).select('_id');
  if (!graded.length) return false;
  return !!(await QuizAttemptModel.exists({
    quiz: { $in: graded.map((q) => q._id) },
    student: studentId,
    status: 'in_progress',
    $or: [{ deadline: null }, { deadline: { $gt: new Date() } }],
  }));
}

// POST /api/courses/:courseId/lessons/:lessonId/ai/chat  { question, history }
// The study assistant: answers a student's question from this lesson's
// text only. Each question uses one of the student's daily AI requests.
export async function lessonChat(req: Request, res: Response) {
  if (req.user!.role !== 'student') throw ApiError.forbidden('The study assistant is for students');
  const access = await courseAccess(req); // enrolled in an active course, else 404
  const p = contentParamsSchema.safeParse(req.params);
  const lesson = p.success
    ? await LessonModel.findOne({ _id: p.data.lessonId, course: access.course._id, status: 'published' }).select('title content')
    : null;
  if (!lesson) throw ApiError.notFound('Lesson not found');
  if (lesson.content.trim().length < MIN_LESSON_CHARS) {
    throw ApiError.badRequest('This lesson has too little text for the study assistant.');
  }
  // No AI help while a graded test is running: it could be used to look up
  // the answers.
  if (await takingGradedTest(access.course._id, req.user!.id)) {
    throw ApiError.conflict("The study assistant is paused while you're taking a graded test in this course.");
  }

  const { question, history } = req.body as LessonChatInput;
  const { result, left } = await withAiRequest(req.user!, () =>
    aiRequest('/v1/chat', chatSchema, {
      method: 'POST',
      body: { lesson: { title: lesson.title, content: lesson.content }, history, question },
    }),
  );
  res.json({ answer: result.answer, left });
}
