import type { RequestHandler } from 'express';
import type { Role } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

// Answers "are you ALLOWED?". Must run after authenticate (which answers
// "who are you?"). Usage: router.get('/x', authenticate, authorize('admin'), handler)
//
// 401 = we don't know who you are; 403 = we know who you are, and the answer is no.
//
// The role comes from the signed access token, so no DB lookup is needed.
// Trade-off: if an admin changes a user's role, it takes effect once the
// user's current access token expires (max 15 minutes).
export const authorize =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    if (!allowed.includes(req.user.role)) {
      throw ApiError.forbidden();
    }
    next();
  };
