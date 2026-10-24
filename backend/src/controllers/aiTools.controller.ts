import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { LessonModel } from '../models/Lesson.js';
import { ApiError } from '../utils/ApiError.js';
import { aiRequest } from '../utils/aiClient.js';
import { withAiRequest } from '../utils/aiQuota.js';
import { questionSchema, type GenerateQuestionsInput } from '../validators/quiz.schema.js';
import { contentParamsSchema } from '../validators/content.schema.js';
import { editAccess } from './content.controller.js';
import { quizIn } from './quiz.controller.js';

// Instructor tools. The AI writes drafts; nothing is saved until the
// instructor reviews them and adds what they want.

// Writing a summary or ten questions takes longer than one explanation.
const TOOL_TIMEOUT_MS = 60000;
// Too little text to summarise or ask about.
const MIN_LESSON_CHARS = 100;

const summarySchema = z.object({ summary: z.string().min(1).max(4000), model: z.string() });
const questionsSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['single', 'multiple', 'true_false', 'short']),
      text: z.string(),
      options: z.array(z.string()),
      correct: z.array(z.number()),
      correct_bool: z.boolean().nullable(),
      accepted_answers: z.array(z.string()),
      explanation: z.string(),
      topic: z.string(),
    }),
  ),
  dropped: z.number(),
  model: z.string(),
});

// A lesson of this course with enough text (drafts included: instructors
// often prepare questions before publishing).
async function sourceLesson(courseId: Types.ObjectId, lessonId: string | undefined) {
  const lesson = lessonId ? await LessonModel.findOne({ _id: lessonId, course: courseId }).select('title content') : null;
  if (!lesson) throw ApiError.notFound('Lesson not found');
  if (lesson.content.trim().length < MIN_LESSON_CHARS) {
    throw ApiError.badRequest('This lesson has too little text for the AI to work with. Write (and save) more first.');
  }
  return { title: lesson.title, content: lesson.content };
}

// POST /api/courses/:courseId/lessons/:lessonId/ai/summary
// Uses the SAVED lesson text (not whatever is in the editor), so the AI
// only ever sees real course content.
export async function summarizeLesson(req: Request, res: Response) {
  const access = await editAccess(req);
  const p = contentParamsSchema.safeParse(req.params);
  const lesson = await sourceLesson(access.course._id, p.success ? p.data.lessonId : undefined);
  const { result, left } = await withAiRequest(req.user!, () =>
    aiRequest('/v1/summary', summarySchema, { method: 'POST', body: { lesson }, timeoutMs: TOOL_TIMEOUT_MS }),
  );
  res.json({ summary: result.summary, left });
}

// POST /api/courses/:courseId/quizzes/:quizId/ai/questions
// { lessonId, count, types, difficulty } → draft questions in the quiz
// builder's format. Each is checked with the builder's own rules; any that
// fail are left out (and counted in `dropped`).
export async function generateQuestions(req: Request, res: Response) {
  const access = await editAccess(req);
  await quizIn(req, access); // the quiz must belong to this course
  const input = req.body as GenerateQuestionsInput;
  const lesson = await sourceLesson(access.course._id, input.lessonId);

  // The checks run inside withQuota: if no question survives them, the
  // request is given back like any other AI failure.
  const { result, left } = await withAiRequest(req.user!, async () => {
    const ai = await aiRequest('/v1/questions', questionsSchema, {
      method: 'POST',
      body: { lesson, count: input.count, types: input.types, difficulty: input.difficulty },
      timeoutMs: TOOL_TIMEOUT_MS,
    });
    let dropped = ai.dropped;
    const drafts = ai.questions.flatMap((q) => {
      const base = { type: q.type, text: q.text, points: 1, topic: q.topic, explanation: q.explanation };
      const draft =
        q.type === 'single'
          ? { ...base, options: q.options, correct: q.correct }
          : q.type === 'multiple'
            ? { ...base, options: q.options, correct: q.correct, partialCredit: false }
            : q.type === 'true_false'
              ? { ...base, correctBool: q.correct_bool }
              : { ...base, answerMode: 'text', acceptedAnswers: q.accepted_answers };
      const checked = questionSchema.safeParse(draft);
      if (!checked.success) {
        dropped++;
        return [];
      }
      return [checked.data];
    });
    if (!drafts.length) throw new ApiError(502, "The AI's questions didn't pass the checks. Try again.");
    return { drafts, dropped };
  });
  res.json({ questions: result.drafts, dropped: result.dropped, left });
}
