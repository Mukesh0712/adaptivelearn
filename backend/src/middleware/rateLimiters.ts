import rateLimit from 'express-rate-limit';

const MINUTE = 60 * 1000;

// Limits are counted per client IP. Each limiter returns 429 with the same
// { message } shape as the rest of the API.
function limiter(windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: windowMinutes * MINUTE,
    limit,
    skipSuccessfulRequests,
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
