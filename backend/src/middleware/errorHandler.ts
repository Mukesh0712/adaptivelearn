import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

export const notFound: RequestHandler = (req) => {
  throw ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);
};

// Every error thrown in a route ends up here (Express 5 also forwards errors
// from async handlers automatically), so all error responses share one shape:
// { message, details? }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ message: err.message, details: err.details });
    return;
  }

  // Malformed JSON body sent by the client.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'Malformed JSON body' });
    return;
  }

  // MongoDB unique-index violation (e.g. two sign-ups with the same email at once).
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
    const isEmail = 'keyPattern' in err && (err.keyPattern as Record<string, unknown>)?.email;
    res.status(409).json({
      message: isEmail ? 'An account with this email already exists' : 'A record with that value already exists',
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    message: 'Internal server error',
    ...(isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
  });
};
