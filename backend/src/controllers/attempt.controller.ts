import { randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { QuizModel, type QuizDocument } from '../models/Quiz.js';
import { QuizAttemptModel, type QuizAttemptDocument } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { gradeQuestion } from '../utils/quizGrading.js';
import { answersVisible, revealHint } from '../utils/quizReveal.js';
import { attemptParamsSchema, type AnswerInput } from '../validators/quiz.schema.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { UserModel } from '../models/User.js';
import { analyseItems, type AnalysedAttempt } from '../utils/itemAnalysis.js';
import { courseAccess, editAccess, type Access } from './content.controller.js';
import { env } from '../config/env.js';
import { aiEnabled } from '../utils/aiClient.js';

// Saves and submits arriving up to this long after the deadline still
// count (the request may have been sent just in time on a slow network).
const GRACE_MS = 15_000;

export const params = (req: Request) => {
  const p = attemptParamsSchema.safeParse(req.params);
  if (!p.success) throw ApiError.notFound('Not found');
  return p.data;
};

// Quizzes are taken by students enrolled in the course.
export async function studentAccess(req: Request): Promise<Access> {
  if (req.user!.role !== 'student') throw ApiError.forbidden('Only students take quizzes');
  return courseAccess(req); // enrolled in an active course, else 404
}

async function publishedQuiz(req: Request, access: Access): Promise<QuizDocument> {
  const { quizId } = params(req);
  const quiz = quizId ? await QuizModel.findOne({ _id: quizId, course: access.course._id, status: 'published' }) : null;
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return quiz;
}

// Fisher-Yates shuffle with a cryptographic random source.
function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const expired = (attempt: QuizAttemptDocument, now = Date.now()) =>
  !!attempt.deadline && now > attempt.deadline.getTime() + GRACE_MS;

// Marks the attempt and records the result. ONE conditional update
// ("…WHERE still in progress"), so a submit and an automatic finish
// arriving together can't grade it twice. Returns the up-to-date attempt.
async function finish(attempt: QuizAttemptDocument, auto: boolean): Promise<QuizAttemptDocument> {
  const graded = attempt.questions.map((q) => {
    const { earned, verdict } = gradeQuestion(q);
    return { ...q.toObject(), earned, correct: verdict };
  });
  const score = Math.round(graded.reduce((n, q) => n + q.earned, 0) * 100) / 100;
  const maxScore = graded.reduce((n, q) => n + q.points, 0);
  const percent = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;
  const done = await QuizAttemptModel.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    {
      $set: {
        status: 'submitted',
        submittedAt: new Date(),
        autoSubmitted: auto,
        questions: graded,
        score,
        maxScore,
        percent,
        passed: percent >= attempt.passPercent,
      },
    },
    { returnDocument: 'after' },
  );
  return done ?? (await QuizAttemptModel.findById(attempt._id))!; // already finished by another request
}

// Time ran out while the student was away: grade what was saved.
async function finishIfExpired(attempt: QuizAttemptDocument | null) {
  if (attempt && attempt.status === 'in_progress' && expired(attempt)) return finish(attempt, true);
  return attempt;
}

// What the student sees while answering: the questions and their own
// answers. Built field by field from an allow-list, so correct answers,
// explanations and accepted answers can never be included by mistake.
function takingView(attempt: QuizAttemptDocument) {
  return {
    id: attempt.id,
    number: attempt.number,
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadline: attempt.deadline,
    serverNow: new Date(), // lets the browser correct for a wrong PC clock
    questions: attempt.questions.map((q) => ({
      id: String(q.questionId),
      type: q.type,
      text: q.text,
      points: q.points,
      answerMode: q.type === 'short' ? q.answerMode : undefined, // number → numeric keyboard
      options: q.options.map((o) => ({ id: String(o._id), text: o.text })),
      answer: { selected: q.selected.map(String), bool: q.answerBool ?? null, text: q.answerText ?? '' },
    })),
  };
}

// After submitting: the score always; correct answers and explanations
// only when the quiz's reveal rule allows it.
// forInstructor: the course's instructor/admin always sees everything.
function resultView(attempt: QuizAttemptDocument, quiz: QuizDocument | null, attemptsUsed: number, forInstructor = false) {
  const revealed = forInstructor || (quiz ? answersVisible(quiz, attemptsUsed) : false);
  return {
    id: attempt.id,
    number: attempt.number,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    autoSubmitted: attempt.autoSubmitted,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passed: attempt.passed,
    passPercent: attempt.passPercent,
    revealed,
    revealHint: revealed || !quiz ? '' : revealHint(quiz),
    // The student may ask the AI to explain their mistakes (see aiFeedback.controller.ts).
    aiExplain: !forInstructor && revealed && aiEnabled && env.AI_STUDENT_DAILY_LIMIT > 0,
    questions: attempt.questions.map((q) => ({
      id: String(q.questionId),
      type: q.type,
      text: q.text,
      points: q.points,
      answerMode: q.type === 'short' ? q.answerMode : undefined,
      options: q.options.map((o) => ({ id: String(o._id), text: o.text })),
      answer: { selected: q.selected.map(String), bool: q.answerBool ?? null, text: q.answerText ?? '' },
      ...(revealed
        ? {
            earned: q.earned,
            verdict: q.correct,
            explanation: q.explanation,
            correctOptions: q.correctOptions.map(String),
            correctBool: q.correctBool,
            acceptedAnswers: q.acceptedAnswers,
            numericAnswer: q.numericAnswer,
            tolerance: q.tolerance,
          }
        : {}),
    })),
  };
}

const attemptSummary = (a: QuizAttemptDocument) => ({
  id: a.id,
  number: a.number,
  status: a.status,
  startedAt: a.startedAt,
  submittedAt: a.submittedAt,
  score: a.status === 'submitted' ? a.score : null,
  maxScore: a.maxScore,
  percent: a.status === 'submitted' ? a.percent : null,
  passed: a.status === 'submitted' ? a.passed : null,
});

// Can this student start (or resume) an attempt now? null = yes.
function startProblem(quiz: QuizDocument, submitted: number, inProgress: boolean): string | null {
  if (inProgress) return null; // resuming is always allowed (until time runs out)
  if (quiz.dueAt && Date.now() > quiz.dueAt.getTime()) return 'The due date has passed.';
  if (quiz.maxAttempts && submitted >= quiz.maxAttempts) {
    return `You've used all ${quiz.maxAttempts} ${quiz.maxAttempts === 1 ? 'attempt' : 'attempts'}.`;
  }
  return null;
}

async function myAttempts(quiz: QuizDocument, studentId: string) {
  const attempts = await QuizAttemptModel.find({ quiz: quiz._id, student: studentId }).sort({ number: 1 });
  // Finish any attempt whose time ran out before reporting.
  return Promise.all(attempts.map((a) => finishIfExpired(a) as Promise<QuizAttemptDocument>));
}

// GET /api/courses/:courseId/quizzes/:quizId/me : the student's quiz page.
export async function quizOverview(req: Request, res: Response) {
  const access = await studentAccess(req);
  const quiz = await publishedQuiz(req, access);
  const attempts = await myAttempts(quiz, req.user!.id);
  const submitted = attempts.filter((a) => a.status === 'submitted');
  const inProgress = attempts.find((a) => a.status === 'in_progress');
  const best = submitted.reduce<number | null>((m, a) => (m === null || a.percent > m ? a.percent : m), null);
  res.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      instructions: quiz.instructions,
      kind: quiz.kind,
      timeLimitMinutes: quiz.timeLimitMinutes,
      maxAttempts: quiz.maxAttempts,
      passPercent: quiz.passPercent,
      dueAt: quiz.dueAt,
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((n, q) => n + q.points, 0),
    },
    course: { id: access.course.id, title: access.course.title },
    attempts: attempts.map(attemptSummary),
    bestPercent: best,
    inProgressId: inProgress?.id ?? null,
    cannotStart: startProblem(quiz, submitted.length, !!inProgress),
  });
}

// POST /api/courses/:courseId/quizzes/:quizId/attempts : start, or resume
// the attempt already in progress.
export async function startAttempt(req: Request, res: Response) {
  const access = await studentAccess(req);
  const quiz = await publishedQuiz(req, access);
  const attempts = await myAttempts(quiz, req.user!.id);
  const current = attempts.find((a) => a.status === 'in_progress');
  if (current) {
    res.json({ attempt: takingView(current), message: 'Welcome back: your answers were saved.' });
    return;
  }
  const problem = startProblem(quiz, attempts.length, false);
  if (problem) throw ApiError.conflict(problem);

  const now = new Date();
  const limitEnd = quiz.timeLimitMinutes ? new Date(now.getTime() + quiz.timeLimitMinutes * 60_000) : null;
  const deadline = quiz.dueAt && (!limitEnd || quiz.dueAt < limitEnd) ? quiz.dueAt : limitEnd;
  const order = quiz.shuffleQuestions ? shuffled(quiz.questions) : [...quiz.questions];
  try {
    const attempt = await QuizAttemptModel.create({
      quiz: quiz._id,
      course: access.course._id,
      student: req.user!.id,
      number: attempts.length + 1,
      startedAt: now,
      deadline,
      passPercent: quiz.passPercent,
      questions: order.map((q) => ({
        questionId: q._id,
        type: q.type,
        text: q.text,
        points: q.points,
        topic: q.topic,
        explanation: q.explanation,
        options: (quiz.shuffleOptions ? shuffled(q.options) : q.options).map((o: { _id: Types.ObjectId; text: string }) => ({ _id: o._id, text: o.text })),
        correctOptions: q.correctOptions,
        partialCredit: q.partialCredit,
        correctBool: q.correctBool,
        answerMode: q.answerMode,
        acceptedAnswers: q.acceptedAnswers,
        numericAnswer: q.numericAnswer,
        tolerance: q.tolerance,
      })),
      maxScore: quiz.questions.reduce((n, q) => n + q.points, 0),
    });
    res.status(201).json({ attempt: takingView(attempt), message: 'Quiz started. Good luck!' });
  } catch (err) {
    // A second Start at the same moment: the unique index refused it. Resume the first.
    if ((err as { code?: number }).code !== 11000) throw err;
    const existing = await QuizAttemptModel.findOne({ quiz: quiz._id, student: req.user!.id, status: 'in_progress' });
    if (!existing) throw err;
    res.json({ attempt: takingView(existing), message: 'Welcome back: your answers were saved.' });
  }
}

// The student's own attempt in a course they're in (anyone else: 404).
export async function myAttempt(req: Request, access: Access) {
  const { attemptId } = params(req);
  const attempt = attemptId
    ? await QuizAttemptModel.findOne({ _id: attemptId, course: access.course._id, student: req.user!.id })
    : null;
  if (!attempt) throw ApiError.notFound('Attempt not found');
  return attempt;
}

// GET /api/courses/:courseId/attempts/:attemptId
export async function getAttempt(req: Request, res: Response) {
  const access = await studentAccess(req);
  const attempt = (await finishIfExpired(await myAttempt(req, access)))!;
  const quiz = await QuizModel.findById(attempt.quiz).select('title kind reveal dueAt maxAttempts');
  if (attempt.status === 'in_progress') {
    res.json({ attempt: takingView(attempt), quiz: { id: String(attempt.quiz), title: quiz?.title ?? 'Quiz' } });
    return;
  }
  const used = await QuizAttemptModel.countDocuments({ quiz: attempt.quiz, student: req.user!.id, status: 'submitted' });
  res.json({ attempt: resultView(attempt, quiz, used), quiz: { id: String(attempt.quiz), title: quiz?.title ?? 'Quiz' } });
}

// PUT /api/courses/:courseId/attempts/:attemptId/answers/:questionId
// Autosave of one answer, checked against that question's own options.
export async function saveAnswer(req: Request, res: Response) {
  const access = await studentAccess(req);
  const attempt = await myAttempt(req, access);
  if (attempt.status !== 'in_progress') throw ApiError.conflict('This attempt has already been submitted.');
  if (expired(attempt)) {
    await finish(attempt, true);
    throw ApiError.conflict("Time's up: your attempt was submitted with the answers saved so far.");
  }
  const { questionId } = params(req);
  const index = attempt.questions.findIndex((q) => String(q.questionId) === questionId);
  const q = attempt.questions[index];
  if (!q) throw ApiError.notFound('Question not found');

  const input = req.body as AnswerInput;
  const set: Record<string, unknown> = {};
  if (q.type === 'single' || q.type === 'multiple') {
    const ids = [...new Set(input.selected ?? [])];
    const valid = new Set(q.options.map((o) => String(o._id)));
    if (!ids.every((id) => valid.has(id)) || (q.type === 'single' && ids.length > 1)) {
      throw ApiError.badRequest('That choice is not one of the options');
    }
    set[`questions.${index}.selected`] = ids;
  } else if (q.type === 'true_false') {
    if (input.bool === undefined) throw ApiError.badRequest('Choose True or False');
    set[`questions.${index}.answerBool`] = input.bool;
  } else {
    if (input.text === undefined) throw ApiError.badRequest('Type an answer');
    set[`questions.${index}.answerText`] = input.text;
  }
  // "…WHERE still in progress": a save can't change an attempt that was
  // submitted a moment ago by another tab.
  const result = await QuizAttemptModel.updateOne({ _id: attempt._id, status: 'in_progress' }, { $set: set });
  if (result.matchedCount === 0) throw ApiError.conflict('This attempt has already been submitted.');
  res.json({ saved: true });
}

// POST /api/courses/:courseId/attempts/:attemptId/submit
export async function submitAttempt(req: Request, res: Response) {
  const access = await studentAccess(req);
  const attempt = await myAttempt(req, access);
  if (attempt.status !== 'in_progress') throw ApiError.conflict('This attempt has already been submitted.');
  const done = await finish(attempt, expired(attempt));
  const quiz = await QuizModel.findById(attempt.quiz).select('title kind reveal dueAt maxAttempts');
  const used = await QuizAttemptModel.countDocuments({ quiz: attempt.quiz, student: req.user!.id, status: 'submitted' });
  res.json({
    attempt: resultView(done, quiz, used),
    message: done.autoSubmitted ? "Time was up: the answers saved before then were marked." : 'Submitted',
  });
}

// For the student's course outline: each published quiz with their best
// score and whether they've started it.
export async function studentQuizSummaries(courseId: Types.ObjectId, studentId: string) {
  const quizzes = await QuizModel.find({ course: courseId, status: 'published' })
    .sort({ createdAt: 1, _id: 1 })
    .select('title module kind dueAt timeLimitMinutes questions.points');
  const attempts = await QuizAttemptModel.find({ course: courseId, student: studentId }).select('quiz status percent');
  return quizzes.map((q) => {
    const mine = attempts.filter((a) => String(a.quiz) === q.id);
    const done = mine.filter((a) => a.status === 'submitted');
    return {
      id: q.id,
      title: q.title,
      module: q.module ? String(q.module) : null,
      kind: q.kind,
      dueAt: q.dueAt,
      timeLimitMinutes: q.timeLimitMinutes,
      questionCount: q.questions.length,
      attempts: done.length,
      inProgress: mine.some((a) => a.status === 'in_progress'),
      bestPercent: done.length ? Math.max(...done.map((a) => a.percent)) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Instructor / admin: results of one quiz.

type Person = { _id: Types.ObjectId; name: string; email: string };

// GET /api/courses/:courseId/quizzes/:quizId/results : the gradebook (every
// enrolled student, including those who haven't started) and the item
// analysis of each question.
export async function quizResults(req: Request, res: Response) {
  const access = await editAccess(req);
  const { quizId } = params(req);
  const quiz = quizId ? await QuizModel.findOne({ _id: quizId, course: access.course._id }) : null;
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const [raw, enrollments] = await Promise.all([
    QuizAttemptModel.find({ quiz: quiz._id }).sort({ number: 1 }),
    EnrollmentModel.find({ course: access.course._id }).populate<{ student: Person | null }>('student', 'name email'),
  ]);
  // Attempts whose time ran out are finished first, so the numbers are final.
  const attempts = await Promise.all(raw.map((a) => finishIfExpired(a) as Promise<QuizAttemptDocument>));

  // Everyone enrolled, plus anyone who took it and has since left the course.
  const people = new Map<string, { person: Person; enrolled: boolean }>();
  for (const e of enrollments) if (e.student) people.set(String(e.student._id), { person: e.student, enrolled: true });
  const missing = [...new Set(attempts.map((a) => String(a.student)))].filter((id) => !people.has(id));
  if (missing.length) {
    const left = await UserModel.find({ _id: { $in: missing } }).select('name email');
    for (const u of left) people.set(u.id, { person: u as unknown as Person, enrolled: false });
  }

  const students = [...people.entries()].map(([id, { person, enrolled }]) => {
    const mine = attempts.filter((a) => String(a.student) === id);
    const done = mine.filter((a) => a.status === 'submitted');
    const best = done.length ? Math.max(...done.map((a) => a.percent)) : null;
    const latest = done.at(-1);
    return {
      id,
      name: person.name,
      email: person.email,
      enrolled,
      attempts: done.length,
      inProgress: mine.some((a) => a.status === 'in_progress'),
      bestPercent: best,
      passed: best === null ? null : best >= quiz.passPercent,
      lastSubmittedAt: latest?.submittedAt ?? null,
      latestAttemptId: latest?.id ?? null,
      attemptIds: done.map((a) => ({ id: a.id, number: a.number, percent: a.percent })),
    };
  });
  students.sort((a, b) => a.name.localeCompare(b.name));

  const attempted = students.filter((s) => s.bestPercent !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  // Item analysis: each student's first submitted attempt.
  const firsts = [...people.keys()]
    .map((id) => attempts.find((a) => String(a.student) === id && a.status === 'submitted'))
    .filter((a): a is QuizAttemptDocument => !!a);

  res.json({
    quiz: { id: quiz.id, title: quiz.title, kind: quiz.kind, passPercent: quiz.passPercent, status: quiz.status },
    course: { id: access.course.id, title: access.course.title },
    stats: {
      enrolled: enrollments.filter((e) => e.student).length,
      attempted: attempted.length,
      submittedAttempts: attempts.filter((a) => a.status === 'submitted').length,
      inProgress: attempts.filter((a) => a.status === 'in_progress').length,
      averageBest: avg(attempted.map((s) => s.bestPercent!)),
      averageFirst: avg(firsts.map((a) => a.percent)),
      passRate: attempted.length ? Math.round((attempted.filter((s) => s.passed).length / attempted.length) * 100) : null,
    },
    students,
    items: analyseItems(firsts.map((a) => a.toObject() as unknown as AnalysedAttempt)),
    itemBase: firsts.length,
  });
}

// GET /api/courses/:courseId/quiz-attempts/:attemptId : one student's
// attempt, with every answer shown (instructor/admin of the course).
export async function reviewAttempt(req: Request, res: Response) {
  const access = await editAccess(req);
  const { attemptId } = params(req);
  const found = attemptId ? await QuizAttemptModel.findOne({ _id: attemptId, course: access.course._id }) : null;
  if (!found) throw ApiError.notFound('Attempt not found');
  const attempt = (await finishIfExpired(found))!;
  const [quiz, student] = await Promise.all([
    QuizModel.findById(attempt.quiz).select('title kind reveal dueAt maxAttempts'),
    UserModel.findById(attempt.student).select('name email'),
  ]);
  const info = {
    quiz: { id: String(attempt.quiz), title: quiz?.title ?? 'Quiz' },
    student: { id: String(attempt.student), name: student?.name ?? 'Former student', email: student?.email ?? '' },
  };
  if (attempt.status === 'in_progress') {
    res.json({
      ...info,
      attempt: {
        id: attempt.id,
        number: attempt.number,
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadline: attempt.deadline,
        answered: attempt.questions.filter((q) => q.selected.length || q.answerBool !== null || q.answerText?.trim()).length,
        total: attempt.questions.length,
        questions: [],
      },
    });
    return;
  }
  res.json({ ...info, attempt: resultView(attempt, quiz, 0, true) });
}
