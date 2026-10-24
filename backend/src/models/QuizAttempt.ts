import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { QUESTION_TYPES } from './Quiz.js';

// The question as the student was given it (options in their shown order).
// Copied when the attempt starts, so later edits to the quiz never change
// what this student saw, how it was graded, or what their review shows.
const snapshotSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    text: { type: String, required: true },
    points: { type: Number, required: true },
    topic: { type: String, default: '' },
    explanation: { type: String, default: '' },
    options: { type: [{ _id: Schema.Types.ObjectId, text: String }], default: [] },
    correctOptions: { type: [Schema.Types.ObjectId], default: [] },
    partialCredit: { type: Boolean, default: false },
    correctBool: { type: Boolean },
    answerMode: { type: String, enum: ['text', 'number'] },
    acceptedAnswers: { type: [String], default: [] },
    numericAnswer: { type: Number },
    tolerance: { type: Number },
    // The student's answer (whichever field fits the type) …
    selected: { type: [Schema.Types.ObjectId], default: [] },
    answerBool: { type: Boolean, default: null },
    answerText: { type: String, default: '' },
    // … and, once submitted, its result.
    earned: { type: Number, default: 0 },
    correct: { type: String, enum: ['correct', 'partial', 'wrong', 'unanswered'], default: 'unanswered' },
  },
  { _id: false },
);

const quizAttemptSchema = new Schema({
  quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  number: { type: Number, required: true }, // 1st, 2nd … attempt
  status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  startedAt: { type: Date, required: true },
  // When answers stop being accepted: start + time limit, but never after
  // the due date. null: no limit.
  deadline: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  // true when the server submitted it because time ran out.
  autoSubmitted: { type: Boolean, default: false },
  questions: { type: [snapshotSchema], default: [] },
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  percent: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  passPercent: { type: Number, default: 50 },
});

// Attempt numbers are unique per student and quiz…
quizAttemptSchema.index({ quiz: 1, student: 1, number: 1 }, { unique: true });
// …and at most ONE attempt can be in progress at a time: clicking Start
// twice can't create two.
quizAttemptSchema.index(
  { quiz: 1, student: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' }, name: 'one_in_progress' },
);
quizAttemptSchema.index({ quiz: 1, status: 1 });
quizAttemptSchema.index({ student: 1 });
// A course's attempts, per student (mastery, recommendations, class insights).
quizAttemptSchema.index({ course: 1, student: 1, status: 1 });

export type QuizAttempt = InferSchemaType<typeof quizAttemptSchema>;
export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;
export const QuizAttemptModel = model('QuizAttempt', quizAttemptSchema);
