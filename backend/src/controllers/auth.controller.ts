import type { Request, Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { UserModel, type UserDocument, type UserStatus } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateResetToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from '../utils/cookies.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '../validators/auth.schema.js';

// A real bcrypt hash of a random string. When the email doesn't exist we
// still run bcrypt against this, so "unknown email" and "wrong password"
// take the same time and can't be told apart by measuring response time.
const DUMMY_HASH = '$2b$10$Cwq1NCErJ2dPfJQ/LioSeejWV13drqJrGMBMTq015Bco63V04ap7i';

interface NewRefresh {
  token: string;
  hash: string;
  expiresAt: Date;
}

// Statuses that may hold a session. $nin also matches accounts with no status
// saved (created before statuses existed), which count as active.
const CAN_SIGN_IN: { $nin: UserStatus[] } = { $nin: ['invited', 'deactivated'] };

function newRefreshToken(userId: string, rememberMe: boolean): NewRefresh {
  const { token, expiresAt } = signRefreshToken(userId, rememberMe);
  return { token, expiresAt, hash: hashToken(token) };
}

// Sets the refresh cookie and sends { user, accessToken }. The caller has
// already saved refresh.hash on the user (in the same DB write as its other
// changes, to keep each request to as few database round trips as possible).
function sendSession(
  res: Response,
  user: UserDocument,
  refresh: NewRefresh,
  rememberMe: boolean,
) {
  setRefreshCookie(res, refresh.token, rememberMe ? refresh.expiresAt : undefined);
  res.json({
    user: user.toJSON(),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
  });
}

// Creates the account only; it does NOT log the user in. The user is sent to
// the login page and signs in there (which is also where the browser offers
// to save the password). 1 DB round trip: a duplicate email is rejected by
// the unique index (→ 409 in errorHandler), so no separate "exists?" query.
export async function register(req: Request, res: Response) {
  const { name, email, password, role } = req.body as RegisterInput;

  const user = await UserModel.create({
    name,
    email,
    password: await hashPassword(password),
    role,
    termsAcceptedAt: new Date(),
  });

  res.status(201).json({
    user: user.toJSON(),
    message: 'Account created. Please log in.',
  });
}

// 2 DB round trips: find the user, then store the new refresh token hash.
export async function login(req: Request, res: Response) {
  const { email, password, rememberMe } = req.body as LoginInput;

  // password has select:false on the schema, so ask for it explicitly here.
  const user = await UserModel.findOne({ email }).select('+password');
  const passwordOk = await verifyPassword(password, user?.password ?? DUMMY_HASH);

  // Same message for "no such user" and "wrong password", so attackers can't
  // use the login form to discover which emails are registered.
  // (Invited users have no password yet, so they always land here too.)
  if (!user || !passwordOk) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  // Only revealed AFTER a correct password, so it doesn't tell strangers
  // which emails belong to deactivated accounts.
  if (user.status === 'deactivated') {
    throw ApiError.forbidden('This account has been deactivated. Please contact your administrator.');
  }

  const refresh = newRefreshToken(user.id, rememberMe);
  user.lastLoginAt = new Date();
  await UserModel.updateOne(
    { _id: user._id },
    { refreshTokenHash: refresh.hash, lastLoginAt: user.lastLoginAt },
  );
  sendSession(res, user, refresh, rememberMe);
}

// Exchanges a valid refresh cookie for a new access token. The refresh token
// is ROTATED: every use issues a new one and the old one stops working.
// 1 DB round trip on success: a single atomic "find the user whose CURRENT
// token is this one, and swap in the new one". Two requests racing with the
// same token can't both succeed.
export async function refresh(req: Request, res: Response) {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || !token) {
    // No cookie = simply not logged in (e.g. a visitor opening the login
    // page). That's a normal state, not an error, so answer "204 No Content"
    // instead of 401 and keep the browser console clean.
    res.status(204).end();
    return;
  }

  let payload: { sub: string; rememberMe: boolean };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const next = newRefreshToken(payload.sub, payload.rememberMe);
  const user = await UserModel.findOneAndUpdate(
    { _id: payload.sub, refreshTokenHash: hashToken(token), status: CAN_SIGN_IN },
    { refreshTokenHash: next.hash },
    { returnDocument: 'after' },
  );

  if (!user) {
    // Validly signed but not the current token → an old token is being
    // replayed, possibly stolen (or the account was deactivated meanwhile). Kill the session so the thief is locked out
    // too (the real user just has to log in again).
    await UserModel.updateOne({ _id: payload.sub }, { refreshTokenHash: null });
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  sendSession(res, user, next, payload.rememberMe);
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

// Always answers the same way, whether or not the email exists, so this
// endpoint can't be used to discover registered emails.
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as ForgotPasswordInput;

  // Invited and deactivated accounts can't reset a password (an invited user
  // sets theirs by accepting the invite).
  const user = await UserModel.findOne({ email, status: CAN_SIGN_IN });
  if (user) {
    const token = generateResetToken();
    await UserModel.updateOne(
      { _id: user._id },
      {
        resetPasswordTokenHash: hashToken(token), // only the hash is stored
        resetPasswordExpiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    );
    const link = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
    // Not awaited: waiting for the mail server would make responses for real
    // accounts slower than for unknown emails, leaking which ones exist.
    sendPasswordResetEmail(user.email, user.name, link).catch((err: unknown) => {
      console.error(
        `Email: FAILED to send password reset to ${user.email}:`,
        err instanceof Error ? err.message : err,
      );
    });
  } else if (!isProduction) {
    console.log(`Email: no active account for ${email}, so no reset email was sent (the user still sees the same reply)`);
  }

  res.json({ message: 'If an account exists for that email, we have sent a password reset link.' });
}

// Sets a new password if the token is valid and unexpired. The token is
// single-use, and every existing session is logged out.
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as ResetPasswordInput;

  const user = await UserModel.findOneAndUpdate(
    {
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
      status: CAN_SIGN_IN,
    },
    {
      password: await hashPassword(password),
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
      refreshTokenHash: null,
    },
  );
  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  clearRefreshCookie(res);
  res.json({ message: 'Your password has been updated. Please log in with your new password.' });
}
