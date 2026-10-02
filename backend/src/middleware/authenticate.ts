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
  let tokenRole: Role;
  let issuedAt: number | undefined;
  try {
    ({ sub: userId, role: tokenRole, iat: issuedAt } = verifyAccessToken(header.slice('Bearer '.length)));
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await UserModel.findById(userId)
    .select('role status passwordChangedAt')
    .lean<{ role: Role; status?: UserStatus; passwordChangedAt?: Date | null }>();
  if (!user) throw ApiError.unauthorized('User no longer exists');
  // Only active accounts get in. (A missing status means an account created
  // before statuses existed: active.) Pending, invited and deactivated
  // accounts are all refused.
  if (user.status && user.status !== 'active') {
    throw ApiError.unauthorized('This account is not active');
  }

  // An Admin changed this user's role after the token was issued. Refuse it:
  // the browser would otherwise keep showing the old portal. (The role change
  // also revoked their session, so they're asked to log in again.)
  if (user.role !== tokenRole) {
    throw ApiError.unauthorized('Your account was changed. Please log in again.');
  }

  // The password changed after this token was issued (e.g. the owner changed
  // it because the account was compromised): the old token no longer works.
  // iat is in whole seconds, so compare at that precision.
  if (user.passwordChangedAt && (issuedAt ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw ApiError.unauthorized('Your password was changed. Please log in again.');
  }

  req.user = { id: userId, role: user.role };
  next();
};
