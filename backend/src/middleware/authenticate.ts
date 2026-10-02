import type { RequestHandler } from 'express';
import { UserModel, type Role, type UserStatus } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';

// Answers "WHO are you?". Reads "Authorization: Bearer <token>", verifies the
// JWT signature + expiry, then loads the user's CURRENT role and status from
// the database and attaches { id, role } to req.user.
//
// Why a DB lookup when the signed token already proves who you are? So that
// Admin actions take effect immediately: a deactivated user is refused on
// their very next request, and a role change applies at once, instead of
// waiting up to 15 minutes for the old access token to expire. The query
// reads only two small fields by _id (the primary key index), so it's cheap.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }

  let userId: string;
  try {
    userId = verifyAccessToken(header.slice('Bearer '.length)).sub;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await UserModel.findById(userId)
    .select('role status')
    .lean<{ role: Role; status?: UserStatus }>();
  if (!user) throw ApiError.unauthorized('User no longer exists');
  // A missing status means an account created before statuses existed: active.
  if (user.status === 'deactivated' || user.status === 'invited') {
    throw ApiError.unauthorized('This account has been deactivated');
  }

  req.user = { id: userId, role: user.role };
  next();
};
