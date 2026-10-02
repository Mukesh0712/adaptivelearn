import type { RequestHandler } from 'express';
import type { Role } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

// Answers "are you ALLOWED?". Must run after authenticate (which answers
// "who are you?"). Usage: router.get('/x', authenticate, authorize('admin'), handler)
//
// 401 = we don't know who you are; 403 = we know who you are, and the answer is no.
//
// req.user.role was loaded fresh from the database by authenticate, so a role
// change made by an Admin applies from the user's next request.
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
