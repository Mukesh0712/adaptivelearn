import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, type UserDocument } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from '../utils/cookies.js';
import type { LoginInput, RegisterInput } from '../validators/auth.schema.js';

// Cost factor 10 = 2^10 hashing rounds: slow enough to make brute-forcing
// stolen hashes expensive, fast enough (~100ms) for a normal login.
const BCRYPT_ROUNDS = 10;

// Issues a fresh token pair: the refresh token goes into an httpOnly cookie
// (and its hash into the DB), the access token goes into the JSON body.
async function startSession(res: Response, user: UserDocument, status = 200) {
  const refresh = signRefreshToken(user.id);
  await UserModel.updateOne({ _id: user._id }, { refreshTokenHash: hashToken(refresh.token) });
  setRefreshCookie(res, refresh.token, refresh.expiresAt);

  res.status(status).json({
    user: user.toJSON(),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
  });
}

export async function register(req: Request, res: Response) {
  const { name, email, password, role } = req.body as RegisterInput;

  if (await UserModel.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await UserModel.create({ name, email, password: hashed, role });

  await startSession(res, user, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  // password has select:false on the schema, so ask for it explicitly here.
  const user = await UserModel.findOne({ email }).select('+password');

  // Same message for "no such user" and "wrong password", so attackers can't
  // use the login form to discover which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  await startSession(res, user);
}

// Exchanges a valid refresh cookie for a new access token. The refresh token
// is ROTATED: every use issues a new one and the old one stops working.
export async function refresh(req: Request, res: Response) {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || !token) {
    throw ApiError.unauthorized('No refresh token');
  }

  let userId: string;
  try {
    userId = verifyRefreshToken(token).sub;
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(userId).select('+refreshTokenHash');
  if (!user) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('User no longer exists');
  }

  if (user.refreshTokenHash !== hashToken(token)) {
    // Validly signed but not the current token → an old token is being
    // replayed, possibly stolen. Kill the session so the thief is locked out
    // too (the real user just has to log in again).
    await UserModel.updateOne({ _id: user._id }, { refreshTokenHash: null });
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  await startSession(res, user);
}

// Doesn't require an access token: logging out must work even after the
// access token has expired.
export async function logout(req: Request, res: Response) {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === 'string' && token) {
    // Only clear the stored hash if this cookie really is the current token.
    await UserModel.updateOne({ refreshTokenHash: hashToken(token) }, { refreshTokenHash: null });
  }
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  res.json({ user: user.toJSON() });
}
