import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AiError, aiEnabled, aiRequest, wakeAiService } from '../utils/aiClient.js';

const statusSchema = z.object({ provider: z.string(), model: z.string() });

// GET /api/admin/ai/status : is the AI service set up and answering?
// Shown on the admin dashboard. Always answers 200 with what it found, so
// the page can explain a problem instead of just showing an error.
export async function aiStatus(_req: Request, res: Response) {
  const limits = { studentDaily: env.AI_STUDENT_DAILY_LIMIT, instructorDaily: env.AI_INSTRUCTOR_DAILY_LIMIT };
  if (!aiEnabled) {
    res.json({ configured: false, reachable: false, limits });
    return;
  }

  const started = Date.now();
  // A sleeping free service needs up to a minute to start, longer than the
  // normal AI time limit, so wake it first.
  await wakeAiService();
  try {
    const status = await aiRequest('/v1/status', statusSchema);
    res.json({ configured: true, reachable: true, ...status, responseMs: Date.now() - started, limits });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.warn(`AI status check failed (${err.kind})${err.detail ? `: ${err.detail}` : ''}`);
    res.json({ configured: true, reachable: false, problem: err.message, limits });
  }
}
