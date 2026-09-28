import type { RequestHandler } from 'express';

// Spam trap. The forms contain a hidden "website" field that people never
// see or fill, but simple bots fill every field. If it has a value, we
// pretend the request succeeded (so the bot learns nothing) and do nothing.
export const HONEYPOT_FIELD = 'website';

export const honeypot =
  (fakeStatus: number, fakeBody: object): RequestHandler =>
  (req, res, next) => {
    const trap: unknown = req.body?.[HONEYPOT_FIELD];
    if (typeof trap === 'string' && trap.trim() !== '') {
      console.warn(`Honeypot triggered on ${req.originalUrl} from ${req.ip}`);
      res.status(fakeStatus).json(fakeBody);
      return;
    }
    next();
  };
