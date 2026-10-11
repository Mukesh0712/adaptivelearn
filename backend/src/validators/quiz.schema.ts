import { z } from 'zod';
import { QUIZ_KINDS, REVEAL_MODES } from '../models/Quiz.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/);

export const quizParamsSchema = z.object({
  courseId: objectId,
  quizId: objectId.optional(),
  questionId: objectId.optional(),
});

// POST /quizzes : a new draft; settings and questions come afterwards.
export const newQuizSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
  module: objectId.nullable().default(null), // null: a course test
  kind: z.enum(QUIZ_KINDS).default('practice'),
});
export type NewQuizInput = z.infer<typeof newQuizSchema>;

// PATCH /quizzes/:quizId : settings. Only the fields sent change (no
// defaults here, or unsent fields would be reset).
const optionalInt = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)
    .nullable();

export const updateQuizSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
    instructions: z.string().max(5000, 'Instructions must be at most 5,000 characters'),
    module: objectId.nullable(),
    kind: z.enum(QUIZ_KINDS),
    timeLimitMinutes: optionalInt(1, 300, 'Time limit'),
    maxAttempts: optionalInt(1, 20, 'Attempts'),
    passPercent: z.number().int().min(0, 'Pass mark must be 0-100').max(100, 'Pass mark must be 0-100'),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    dueAt: z.iso.datetime({ offset: true, error: 'Enter a valid date and time' }).nullable(),
    reveal: z.enum(REVEAL_MODES),
    status: z.enum(['draft', 'published']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

// One question, as the builder sends it. Options are plain texts; the right
// ones are given by their position in the list (correct: [0, 2]).
const common = {
  text: z.string().trim().min(1, 'Write the question').max(5000, 'Question must be at most 5,000 characters'),
  points: z.number().int('Points must be a whole number').min(1, 'At least 1 point').max(100, 'At most 100 points').default(1),
  topic: z.string().trim().max(60, 'Topic must be at most 60 characters').default(''),
  explanation: z.string().trim().max(2000, 'Explanation must be at most 2,000 characters').default(''),
};
const optionList = (min: number, max: number) =>
  z
    .array(z.string().trim().min(1, 'An option is empty').max(500, 'Options must be at most 500 characters'), {
      error: 'Add the options',
    })
    .min(min, `Add at least ${min} options`)
    .max(max, `At most ${max} options`)
    .refine((o) => new Set(o.map((t) => t.toLowerCase())).size === o.length, 'Two options are the same');

export const questionSchema = z.discriminatedUnion(
  'type',
  [
    z
      .object({ type: z.literal('single'), ...common, options: optionList(2, 6), correct: z.array(z.number().int()).length(1, 'Mark the one correct option') })
      .refine((q) => q.correct.every((i) => i >= 0 && i < q.options.length), { message: 'Mark the correct option', path: ['correct'] }),
    z
      .object({
        type: z.literal('multiple'),
        ...common,
        options: optionList(2, 8),
        correct: z.array(z.number().int()).min(1, 'Mark at least one correct option'),
        partialCredit: z.boolean().default(false),
      })
      .refine((q) => new Set(q.correct).size === q.correct.length && q.correct.every((i) => i >= 0 && i < q.options.length), {
        message: 'Mark the correct options',
        path: ['correct'],
      }),
    z.object({ type: z.literal('true_false'), ...common, correctBool: z.boolean({ error: 'Choose True or False' }) }),
    z.discriminatedUnion('answerMode', [
      z.object({
        type: z.literal('short'),
        ...common,
        answerMode: z.literal('text'),
        acceptedAnswers: z
          .array(z.string().trim().min(1).max(100, 'Answers must be at most 100 characters'))
          .min(1, 'Add at least one accepted answer')
          .max(10, 'At most 10 accepted answers'),
      }),
      z.object({
        type: z.literal('short'),
        ...common,
        answerMode: z.literal('number'),
        numericAnswer: z.number({ error: 'Enter the correct number' }).finite(),
        tolerance: z.number().min(0, 'Tolerance cannot be negative').max(1e9).default(0),
      }),
    ]),
  ],
  { error: 'Choose a question type' },
);
export type QuestionInput = z.infer<typeof questionSchema>;

export const attemptParamsSchema = z.object({
  courseId: objectId,
  quizId: objectId.optional(),
  attemptId: objectId.optional(),
  questionId: objectId.optional(),
});

// PUT …/attempts/:attemptId/answers/:questionId : one answer. Which field
// is used depends on the question's type (checked in the controller).
export const answerSchema = z
  .object({
    selected: z.array(objectId).max(8),
    bool: z.boolean().nullable(),
    text: z.string().max(500, 'Answers must be at most 500 characters'),
  })
  .partial();
export type AnswerInput = z.infer<typeof answerSchema>;
