import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';

// Answers "WHO are you?". Reads "Authorization: Bearer <token>", verifies the
// JWT signature + expiry, and attaches { id, role } to req.user.
// No DB lookup is needed: the signature proves the server issued this token.
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
  next();
};
