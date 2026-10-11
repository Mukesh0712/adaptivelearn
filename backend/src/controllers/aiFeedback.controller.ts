import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AiFeedbackModel } from '../models/AiFeedback.js';
import { QuizModel } from '../models/Quiz.js';
import { QuizAttemptModel, type QuizAttemptDocument } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { aiRequest, currentModel } from '../utils/aiClient.js';
import { aiRequestsLeft, takeAiRequest } from '../utils/aiQuota.js';
import { normalise } from '../utils/quizGrading.js';
import { answersVisible } from '../utils/quizReveal.js';
import { myAttempt, params, studentAccess } from './attempt.controller.js';

type Snapshot = QuizAttemptDocument['questions'][number];

// Bump when the prompt changes in a way that makes old explanations wrong.
const PROMPT_VERSION = 1;

const feedbackSchema = z.object({ feedback: z.string().min(1).max(4000), model: z.string() });

// The question and answers as plain text, the way the AI service expects
// them. Only quiz content: nothing that identifies the student.
// Options are sorted, so the same question shuffled differently for two
// students still gives the same cache key.
function feedbackRequest(q: Snapshot) {
  const optionText = new Map(q.options.map((o) => [String(o._id), o.text ?? '']));
  const texts = (ids: unknown[]) =>
    ids
      .map((id) => optionText.get(String(id)))
      .filter((t): t is string => !!t)
      .sort();

  let correct: string[];
  let student: string[];
  if (q.type === 'single' || q.type === 'multiple') {
    correct = texts(q.correctOptions);
    student = texts(q.selected);
  } else if (q.type === 'true_false') {
    correct = [q.correctBool ? 'True' : 'False'];
    student = q.answerBool == null ? [] : [q.answerBool ? 'True' : 'False'];
  } else {
    correct =
      q.answerMode === 'number'
        ? [`${q.numericAnswer}${q.tolerance ? ` (± ${q.tolerance})` : ''}`]
        : [...q.acceptedAnswers];
    student = q.answerText?.trim() ? [q.answerText.trim()] : [];
  }

  return {
    question: {
      type: q.type,
      text: q.text,
      topic: q.topic ?? '',
      explanation: q.explanation ?? '',
      options: q.type === 'single' || q.type === 'multiple' ? q.options.map((o) => o.text ?? '').sort() : [],
      correct,
    },
    student_answer: student,
    verdict: q.correct as 'wrong' | 'partial' | 'unanswered',
  };
}

// Same mistake on the same question with the same model → same key.
// Typed answers are compared the way grading does ("  Paris" = "paris").
function cacheKey(model: string, body: ReturnType<typeof feedbackRequest>) {
  const answer = body.question.type === 'short' ? body.student_answer.map(normalise) : body.student_answer;
  const canonical = JSON.stringify({ v: PROMPT_VERSION, model, ...body, student_answer: answer });
  return createHash('sha256').update(canonical).digest('hex');
}

// POST /api/courses/:courseId/attempts/:attemptId/questions/:questionId/explain
// The student asks the AI why their answer was wrong.
export async function explainAnswer(req: Request, res: Response) {
  const access = await studentAccess(req);
  const attempt = await myAttempt(req, access);
  if (attempt.status !== 'submitted') throw ApiError.conflict('Submit the attempt first.');

  // Only once the correct answers are shown: an explanation gives the
  // answer away, so before then it would leak a graded test's answers.
  const quiz = await QuizModel.findById(attempt.quiz).select('kind reveal dueAt maxAttempts');
  const used = await QuizAttemptModel.countDocuments({ quiz: attempt.quiz, student: req.user!.id, status: 'submitted' });
  if (!quiz || !answersVisible(quiz, used)) {
    throw ApiError.forbidden('Explanations are available once the correct answers are shown.');
  }

  const { questionId } = params(req);
  const q = attempt.questions.find((x) => String(x.questionId) === questionId);
  if (!q) throw ApiError.notFound('Question not found');
  if (q.correct === 'correct') throw ApiError.badRequest('This answer is already correct.');

  const body = feedbackRequest(q);
  const model = await currentModel();
  const key = cacheKey(model, body);

  const cached = await AiFeedbackModel.findOne({ key });
  if (cached) {
    // Free: no AI call, so nothing is counted against the daily limit.
    res.json({ feedback: cached.text, left: await aiRequestsLeft(req.user!) });
    return;
  }

  const { left, refund } = await takeAiRequest(req.user!);
  let result: z.infer<typeof feedbackSchema>;
  try {
    result = await aiRequest('/v1/feedback', feedbackSchema, { method: 'POST', body });
  } catch (err) {
    await refund(); // the AI didn't answer: this one doesn't count
    throw err;
  }

  // The model changed between the two calls: don't file the answer under
  // the old model's key.
  if (result.model === model) {
    await AiFeedbackModel.updateOne(
      { key },
      { $setOnInsert: { text: result.feedback, model: result.model } },
      { upsert: true },
    ).catch((err: { code?: number }) => {
      if (err.code !== 11000) throw err; // another student saved it a moment earlier: fine
    });
  }
  res.json({ feedback: result.feedback, left });
}
