import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const QUESTION_TYPES = ['single', 'multiple', 'true_false', 'short'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUIZ_KINDS = ['practice', 'graded'] as const;
// When students may see the correct answers (see utils/quizReveal.ts).
export const REVEAL_MODES = ['auto', 'immediately', 'after_due', 'never'] as const;
export const MAX_QUESTIONS = 100;

// Plain question object → API shape (string ids, no _id).
export function questionToJSON(q: Record<string, unknown>) {
  const { _id, options, correctOptions, ...rest } = q;
  return {
    id: String(_id),
    ...rest,
    options: ((options ?? []) as { _id: unknown; text: string }[]).map((o) => ({ id: String(o._id), text: o.text })),
    correctOptions: ((correctOptions ?? []) as unknown[]).map(String),
  };
}

const optionSchema = new Schema({ text: { type: String, required: true, maxlength: 500 } });

// One question, stored inside its quiz (always loaded together).
// Which fields are used depends on `type`:
//  - single / multiple: options + correctOptions (ids of the right options)
//  - true_false:        correctBool
//  - short:             answerMode 'text' → acceptedAnswers (any one matches,
//                       ignoring case and extra spaces); 'number' →
//                       numericAnswer ± tolerance
const questionSchema = new Schema({
  type: { type: String, enum: QUESTION_TYPES, required: true },
  text: { type: String, required: true, maxlength: 5000 }, // Markdown
  points: { type: Number, required: true, min: 1, max: 100, default: 1 },
  // Optional skill/topic, e.g. "Arrays: indexing". Phase 9 measures mastery per topic.
  topic: { type: String, trim: true, maxlength: 60, default: '' },
  explanation: { type: String, maxlength: 2000, default: '' }, // shown when answers are revealed
  options: { type: [optionSchema], default: [] },
  correctOptions: { type: [Schema.Types.ObjectId], default: [] },
  partialCredit: { type: Boolean, default: false }, // multiple: points in proportion
  correctBool: { type: Boolean },
  answerMode: { type: String, enum: ['text', 'number'] },
  acceptedAnswers: { type: [String], default: [] },
  numericAnswer: { type: Number },
  tolerance: { type: Number, min: 0 },
});

const quizSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    // A quiz inside a module (shown after that module's lessons), or null
    // for a standalone course test (e.g. "Mid-term").
    module: { type: Schema.Types.ObjectId, ref: 'Module', default: null },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    instructions: { type: String, maxlength: 5000, default: '' }, // Markdown
    kind: { type: String, enum: QUIZ_KINDS, default: 'practice' },
    timeLimitMinutes: { type: Number, min: 1, max: 300, default: null }, // null: no limit
    maxAttempts: { type: Number, min: 1, max: 20, default: null }, // null: unlimited
    passPercent: { type: Number, min: 0, max: 100, default: 50 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    dueAt: { type: Date, default: null },
    reveal: { type: String, enum: REVEAL_MODES, default: 'auto' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        ret.course = String(ret.course);
        ret.module = ret.module ? String(ret.module) : null;
        // Questions and options: { id } like every other API object.
        ret.questions = ((ret.questions ?? []) as Record<string, unknown>[]).map((q) => questionToJSON(q));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

quizSchema.index({ course: 1, createdAt: 1 });
quizSchema.index({ module: 1 });

export type Quiz = InferSchemaType<typeof quizSchema>;
export type QuizDocument = HydratedDocument<Quiz>;
export const QuizModel = model('Quiz', quizSchema);
