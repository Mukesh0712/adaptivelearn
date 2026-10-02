import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const MINUTE = 60 * 1000;

// Limits are counted per client IP. Each limiter returns 429 with the same
// { message } shape as the rest of the API.
function limiter(
  windowMinutes: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false,
  keyGenerator?: (req: Request) => string,
) {
  return rateLimit({
    windowMs: windowMinutes * MINUTE,
    limit,
    skipSuccessfulRequests,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: 'draft-8', // RateLimit-* headers tell clients when to retry
    legacyHeaders: false,
    message: { message },
  });
}

// Counts only FAILED logins, so normal users are never blocked but password
// guessing stops after 10 wrong attempts in 15 minutes.
export const loginLimiter = limiter(
  15,
  10,
  'Too many failed login attempts. Please try again in 15 minutes.',
  true,
);

export const registerLimiter = limiter(
  60,
  10,
  'Too many accounts created from this network. Please try again later.',
);

// Stops using the reset form to spam someone's inbox or guess reset tokens.
export const passwordResetLimiter = limiter(
  15,
  5,
  'Too many password reset requests. Please try again in 15 minutes.',
);

// Opening and accepting invite links: stops guessing invite tokens.
export const inviteLimiter = limiter(15, 20, 'Too many attempts. Please try again in 15 minutes.');

// Joining a course: only WRONG codes count, so normal students are never
// blocked, but guessing join codes stops after 10 misses in 15 minutes.
// Counted per student ACCOUNT, not per IP: a whole class on the college
// Wi-Fi shares one IP, and a few classmates' typos must not lock everyone
// out. (Creating many accounts to get around it is itself rate limited.)
export const joinCourseLimiter = limiter(
  15,
  10,
  'Too many incorrect join codes. Please try again in 15 minutes.',
  true,
  (req) => `user:${req.user!.id}`, // runs after authenticate, so req.user is set
);
