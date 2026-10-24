import { Schema, model, type InferSchemaType } from 'mongoose';

// How many AI requests each person has made today (one document per person
// per day). The daily limits in .env are checked against `count`.
const aiUsageSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true }, // "2026-10-11" (UTC)
  count: { type: Number, default: 0 },
  // Old days are no longer needed: MongoDB deletes them after this time.
  expiresAt: { type: Date, required: true },
});

aiUsageSchema.index({ user: 1, day: 1 }, { unique: true });
aiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AiUsage = InferSchemaType<typeof aiUsageSchema>;
export const AiUsageModel = model('AiUsage', aiUsageSchema);
