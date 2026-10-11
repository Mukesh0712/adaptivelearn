import { Schema, model, type InferSchemaType } from 'mongoose';

// Cached AI explanations of wrong quiz answers.
//
// key = SHA-256 of (model + the question exactly as the student saw it + the
// student's answer). The next student who makes the SAME mistake on the
// SAME question gets the saved explanation instantly, without a new AI call.
// Editing the question or switching AI model changes the key, so an old
// explanation is never shown for a changed question.
//
// Holds no personal data: no student, no name, only the explanation text.
const aiFeedbackSchema = new Schema({
  key: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  model: { type: String, required: true },
  // Deleted automatically after 180 days, so the cache can't grow forever.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
});

export type AiFeedback = InferSchemaType<typeof aiFeedbackSchema>;
export const AiFeedbackModel = model('AiFeedback', aiFeedbackSchema);
