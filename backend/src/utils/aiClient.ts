import type { z } from 'zod';
import { env } from '../config/env.js';

// The only place the backend talks to the Python AI service.
//
// Browsers never call the AI service: they call our API, which checks who
// they are and what they may do, then calls the service with the shared
// secret. The secret stays on the two servers.

export const aiEnabled = !!(env.AI_SERVICE_URL && env.AI_SERVICE_SECRET);

if (!aiEnabled && (env.AI_SERVICE_URL || env.AI_SERVICE_SECRET)) {
  console.warn('AI features are off: set BOTH AI_SERVICE_URL and AI_SERVICE_SECRET to switch them on.');
}

// Why an AI call failed, in words a user can be shown.
//   disabled     AI isn't set up on this server
//   timeout      no answer in time (often: the free service is waking from sleep)
//   unavailable  the service couldn't be reached, or reported an error
//   rejected     the service refused our secret (the two servers' secrets differ)
//   bad_response the answer wasn't in the expected shape
export type AiErrorKind = 'disabled' | 'timeout' | 'unavailable' | 'rejected' | 'bad_response';

const MESSAGES: Record<AiErrorKind, string> = {
  disabled: 'AI features are not set up on this server',
  timeout: 'The AI service is starting up or busy. Try again in a minute.',
  unavailable: 'The AI service is not available right now. Try again later.',
  rejected: 'The AI service is not set up correctly. Ask the admin to check it.',
  bad_response: 'The AI service sent an unexpected answer. Try again.',
};

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    // Extra detail for the server log only (never sent to the browser).
    public readonly detail?: string,
  ) {
    super(MESSAGES[kind]);
    this.name = 'AiError';
  }
}

type Options = { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number };

// Calls one AI-service endpoint and checks the answer against `schema`, so
// the rest of the code can trust its shape.
export async function aiRequest<S extends z.ZodType>(path: string, schema: S, opts: Options = {}): Promise<z.infer<S>> {
  if (!aiEnabled) throw new AiError('disabled');

  let res: Response;
  try {
    res = await fetch(new URL(path, env.AI_SERVICE_URL), {
      method: opts.method ?? 'GET',
      headers: {
        'X-Internal-Key': env.AI_SERVICE_SECRET!,
        ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: opts.body === undefined ? null : JSON.stringify(opts.body),
      // Gives up after the time limit, so a slow AI never holds a request
      // (and its user) waiting forever.
      signal: AbortSignal.timeout(opts.timeoutMs ?? env.AI_TIMEOUT_MS),
      // The service never redirects. Following one could send the secret
      // somewhere else.
      redirect: 'error',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') throw new AiError('timeout');
    throw new AiError('unavailable', err instanceof Error ? (err.cause as Error)?.message ?? err.message : String(err));
  }

  if (res.status === 401) throw new AiError('rejected', 'AI service answered 401: AI_SERVICE_SECRET differs');
  if (!res.ok) throw new AiError('unavailable', `AI service answered HTTP ${res.status}`);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError('bad_response', 'AI service answer was not JSON');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AiError('bad_response', parsed.error.message);
  return parsed.data;
}

// Wakes the AI service (Render's free plan puts it to sleep after ~15
// minutes without requests; waking takes up to a minute). /health is public,
// needs no secret and costs nothing.
export async function wakeAiService(timeoutMs = 60000): Promise<boolean> {
  if (!aiEnabled) return false;
  try {
    const res = await fetch(new URL('/health', env.AI_SERVICE_URL), {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    return res.ok;
  } catch {
    return false;
  }
}
