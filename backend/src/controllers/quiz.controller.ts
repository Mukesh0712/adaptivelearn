import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ModuleModel } from '../models/Module.js';
import { MAX_QUESTIONS, QuizModel, questionToJSON, type QuizDocument } from '../models/Quiz.js';
import { ApiError } from '../utils/ApiError.js';
import {
  quizParamsSchema,
  type NewQuizInput,
  type QuestionInput,
  type UpdateQuizInput,
} from '../validators/quiz.schema.js';
import type { OrderInput } from '../validators/content.schema.js';
import { editAccess, type Access } from './content.controller.js';

const MAX_QUIZZES = 200;

const params = (req: Request) => {
  const p = quizParamsSchema.safeParse(req.params);
  if (!p.success) throw ApiError.notFound('Not found');
  return p.data;
};

// A quiz of THIS course (an id from another course gives 404).
async function quizIn(req: Request, access: Access): Promise<QuizDocument> {
  const { quizId } = params(req);
  const quiz = quizId ? await QuizModel.findOne({ _id: quizId, course: access.course._id }) : null;
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return quiz;
}

// The module must belong to this course.
async function checkModule(access: Access, moduleId: string | null) {
  if (moduleId && !(await ModuleModel.exists({ _id: moduleId, course: access.course._id }))) {
    throw ApiError.badRequest('Validation failed', { module: ['That module is not in this course'] });
  }
}

const totalPoints = (quiz: QuizDocument) => quiz.questions.reduce((n, q) => n + q.points, 0);

// The list row (no questions): used by the course page's Quizzes card.
function summary(quiz: QuizDocument, moduleTitles: Map<string, string>) {
  return {
    id: quiz.id,
    title: quiz.title,
    module: quiz.module ? String(quiz.module) : null,
    moduleTitle: quiz.module ? (moduleTitles.get(String(quiz.module)) ?? '') : null,
    kind: quiz.kind,
    status: quiz.status,
    dueAt: quiz.dueAt,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questionCount: quiz.questions.length,
    totalPoints: totalPoints(quiz),
  };
}

// What would stop this quiz being published (empty list = ready).
// dueAt can be the value about to be saved.
function publishProblems(quiz: QuizDocument, dueAt: Date | null = quiz.dueAt ?? null): string[] {
  const problems: string[] = [];
  if (quiz.questions.length === 0) problems.push('Add at least one question');
  if (dueAt && dueAt.getTime() < Date.now()) problems.push('The due date is in the past');
  return problems;
}

// GET /api/courses/:courseId/quizzes : every quiz of the course (editors).
export async function listQuizzes(req: Request, res: Response) {
  const access = await editAccess(req);
  const [quizzes, modules] = await Promise.all([
    QuizModel.find({ course: access.course._id }).sort({ createdAt: 1, _id: 1 }),
    ModuleModel.find({ course: access.course._id }).select('title'),
  ]);
  const titles = new Map(modules.map((m) => [m.id as string, m.title]));
  res.json({ quizzes: quizzes.map((q) => summary(q, titles)) });
}

// POST /api/courses/:courseId/quizzes  { title, module, kind } : a new draft.
export async function createQuiz(req: Request, res: Response) {
  const access = await editAccess(req);
  const { title, module, kind } = req.body as NewQuizInput;
  await checkModule(access, module);
  if ((await QuizModel.countDocuments({ course: access.course._id })) >= MAX_QUIZZES) {
    throw ApiError.conflict(`A course can have at most ${MAX_QUIZZES} quizzes.`);
  }
  const quiz = await QuizModel.create({ course: access.course._id, module, title, kind });
  res.status(201).json({ quiz: quiz.toJSON(), message: `Quiz "${quiz.title}" created as a draft` });
}

// GET /api/courses/:courseId/quizzes/:quizId : the full quiz, answers
// included. Editors only: students get a separate view in Step 2 that
// never contains the answers.
export async function getQuizForEditing(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  const modules = await ModuleModel.find({ course: access.course._id }).sort({ position: 1 }).select('title');
  res.json({
    quiz: { ...quiz.toJSON(), totalPoints: totalPoints(quiz) },
    course: { id: access.course.id, title: access.course.title },
    modules: modules.map((m) => ({ id: m.id, title: m.title })),
    topics: await courseTopics(access),
    publishProblems: publishProblems(quiz),
  });
}

// Topics already used in this course: suggestions for the topic field.
async function courseTopics(access: Access): Promise<string[]> {
  const quizzes = await QuizModel.find({ course: access.course._id }).select('questions.topic');
  const topics = new Set<string>();
  for (const q of quizzes) for (const question of q.questions) if (question.topic) topics.add(question.topic);
  return [...topics].sort((a, b) => a.localeCompare(b));
}

// PATCH /api/courses/:courseId/quizzes/:quizId : settings, publish/unpublish.
export async function updateQuiz(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  const { dueAt, ...changes } = req.body as UpdateQuizInput;
  if (changes.module !== undefined) await checkModule(access, changes.module);
  const nextDue = dueAt === undefined ? (quiz.dueAt ?? null) : dueAt ? new Date(dueAt) : null;
  const publishing = changes.status === 'published' && quiz.status !== 'published';
  const unpublishing = changes.status === 'draft' && quiz.status === 'published';
  // Checked BEFORE anything changes, so a refused request changes nothing.
  if (publishing) {
    const problems = publishProblems(quiz, nextDue);
    if (problems.length) throw ApiError.conflict(`Can't publish yet: ${problems.join('; ')}.`);
  }
  quiz.set(changes);
  quiz.dueAt = nextDue;
  if (publishing) quiz.publishedAt = new Date();
  await quiz.save();
  const message = publishing
    ? 'Quiz published. Students can take it now.'
    : unpublishing
      ? 'Quiz moved back to draft. Students no longer see it.'
      : 'Quiz saved';
  res.json({ quiz: { ...quiz.toJSON(), totalPoints: totalPoints(quiz) }, publishProblems: publishProblems(quiz), message });
}

// DELETE /api/courses/:courseId/quizzes/:quizId
export async function deleteQuiz(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  await quiz.deleteOne();
  res.json({ message: `Quiz "${quiz.title}" deleted` });
}

// Builder input → stored question. Options get ids; the correct ones are
// stored by id (positions change when options are reordered later).
function toQuestion(input: QuestionInput) {
  const base = { type: input.type, text: input.text, points: input.points, topic: input.topic, explanation: input.explanation };
  switch (input.type) {
    case 'single':
    case 'multiple': {
      const options = input.options.map((text) => ({ _id: new Types.ObjectId(), text }));
      return {
        ...base,
        options,
        correctOptions: input.correct.map((i) => options[i]!._id),
        partialCredit: input.type === 'multiple' ? input.partialCredit : false,
      };
    }
    case 'true_false':
      return { ...base, correctBool: input.correctBool };
    case 'short':
      return input.answerMode === 'text'
        ? { ...base, answerMode: 'text' as const, acceptedAnswers: input.acceptedAnswers }
        : { ...base, answerMode: 'number' as const, numericAnswer: input.numericAnswer, tolerance: input.tolerance };
  }
}

function questionOf(quiz: QuizDocument, req: Request) {
  const { questionId } = params(req);
  const question = questionId ? quiz.questions.id(questionId) : null;
  if (!question) throw ApiError.notFound('Question not found');
  return question;
}

// POST /api/courses/:courseId/quizzes/:quizId/questions
export async function addQuestion(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  if (quiz.questions.length >= MAX_QUESTIONS) throw ApiError.conflict(`A quiz can have at most ${MAX_QUESTIONS} questions.`);
  quiz.questions.push(toQuestion(req.body as QuestionInput));
  await quiz.save();
  res.status(201).json({
    question: quiz.toJSON().questions.at(-1),
    totalPoints: totalPoints(quiz),
    message: 'Question added',
  });
}

// PUT /api/courses/:courseId/quizzes/:quizId/questions/:questionId : replace it.
export async function updateQuestion(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  const question = questionOf(quiz, req);
  // Same id, new content. Fields of the previous type are cleared.
  question.set({
    options: [],
    correctOptions: [],
    partialCredit: false,
    correctBool: undefined,
    answerMode: undefined,
    acceptedAnswers: [],
    numericAnswer: undefined,
    tolerance: undefined,
    ...toQuestion(req.body as QuestionInput),
  });
  await quiz.save();
  res.json({ question: questionToJSON(question.toObject()), totalPoints: totalPoints(quiz), message: 'Question saved' });
}

// DELETE /api/courses/:courseId/quizzes/:quizId/questions/:questionId
export async function deleteQuestion(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  const question = questionOf(quiz, req);
  if (quiz.status === 'published' && quiz.questions.length === 1) {
    throw ApiError.conflict('A published quiz needs at least one question. Move it to draft first.');
  }
  question.deleteOne();
  await quiz.save();
  res.json({ totalPoints: totalPoints(quiz), message: 'Question deleted' });
}

// PUT /api/courses/:courseId/quizzes/:quizId/questions/order  { ids }
export async function reorderQuestions(req: Request, res: Response) {
  const access = await editAccess(req);
  const quiz = await quizIn(req, access);
  const { ids } = req.body as OrderInput;
  const have = new Set(quiz.questions.map((q) => String(q._id)));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) {
    throw ApiError.conflict('The list changed since you loaded it. Refresh and try again.');
  }
  const byId = new Map(quiz.questions.map((q) => [String(q._id), q.toObject()]));
  quiz.set('questions', ids.map((id) => byId.get(id)));
  await quiz.save();
  res.json({ message: 'Order saved' });
}
