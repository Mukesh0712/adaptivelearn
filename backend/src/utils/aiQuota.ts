import { env } from '../config/env.js';
import { AiUsageModel } from '../models/AiUsage.js';
import { ApiError } from './ApiError.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date in UTC. Limits reset at midnight UTC (5:30 am in India).
const today = () => new Date().toISOString().slice(0, 10);

// The daily limit for a role. Admins share the instructor limit; parents
// don't use AI features.
export function dailyLimit(role: string): number {
  if (role === 'student') return env.AI_STUDENT_DAILY_LIMIT;
  if (role === 'instructor' || role === 'admin') return env.AI_INSTRUCTOR_DAILY_LIMIT;
  return 0;
}

// Requests left today (for showing "12 left today").
export async function aiRequestsLeft(user: { id: string; role: string }): Promise<number> {
  const usage = await AiUsageModel.findOne({ user: user.id, day: today() }).select('count');
  return Math.max(0, dailyLimit(user.role) - (usage?.count ?? 0));
}

// Counts one AI request against today's limit, or refuses with 429.
// Returns `refund`, to give the request back if the AI call then fails.
//
// ONE atomic update: "add 1 WHERE count < limit". Two requests at the same
// moment can't both take the last one. When the limit is reached nothing
// matches, so MongoDB tries to insert a second document for today, and the
// unique (user, day) index refuses it: that duplicate-key error means
// "limit reached".
export async function takeAiRequest(user: { id: string; role: string }) {
  const limit = dailyLimit(user.role);
  if (limit <= 0) throw ApiError.forbidden('AI help is not available for your account');
  const day = today();

  for (let tries = 0; ; tries++) {
    try {
      const usage = await AiUsageModel.findOneAndUpdate(
        { user: user.id, day, count: { $lt: limit } },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * DAY_MS) } },
        { upsert: true, returnDocument: 'after' },
      );
      return {
        left: Math.max(0, limit - (usage?.count ?? limit)),
        refund: async () => {
          await AiUsageModel.updateOne({ user: user.id, day, count: { $gt: 0 } }, { $inc: { count: -1 } });
        },
      };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      // Very first request of the day sent twice at once: both tried to
      // create today's document. Try once more; then it really is the limit.
      if (tries >= 1) {
        throw new ApiError(
          429,
          `You've used all ${limit} AI requests for today. They reset at midnight UTC (5:30 am IST).`,
        );
      }
    }
  }
}

// Runs one AI request counted against the caller's daily limit, and gives
// it back if `run` fails (AI down, unusable answer...).
export async function withAiRequest<T>(user: { id: string; role: string }, run: () => Promise<T>) {
  const { left, refund } = await takeAiRequest(user);
  try {
    return { result: await run(), left };
  } catch (err) {
    await refund();
    throw err;
  }
}
