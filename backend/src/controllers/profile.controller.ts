import type { Request, Response } from 'express';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { setRefreshCookie, REFRESH_COOKIE } from '../utils/cookies.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import type { ChangePasswordInput, UpdateProfileInput } from '../validators/profile.schema.js';

// PATCH /api/profile : change your own name. (Email isn't editable: changing
// it safely needs a verification email to the new address.)
export async function updateProfile(req: Request, res: Response) {
  const { name } = req.body as UpdateProfileInput;
  const user = await UserModel.findByIdAndUpdate(req.user!.id, { name }, { returnDocument: 'after' });
  if (!user) throw ApiError.unauthorized('User no longer exists');
  res.json({ user: user.toJSON(), message: 'Profile updated' });
}

// POST /api/profile/password
// Requires the CURRENT password, so someone at an unlocked computer can't
// change it. Afterwards every other device is logged out: their refresh
// token is replaced, and their access tokens are refused because they were
// issued before passwordChangedAt. This device gets a fresh session.
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  const user = await UserModel.findById(req.user!.id).select('+password');
  if (!user?.password || !(await verifyPassword(currentPassword, user.password))) {
    throw ApiError.badRequest('Your current password is incorrect', {
      currentPassword: ['Your current password is incorrect'],
    });
  }

  // Keep this device's "Remember me" choice for its new session.
  let rememberMe = false;
  const cookie: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof cookie === 'string' && cookie) {
    try {
      rememberMe = verifyRefreshToken(cookie).rememberMe;
    } catch {
      // expired or invalid cookie: a normal session
    }
  }
  const refresh = signRefreshToken(user.id, rememberMe);
  await UserModel.updateOne(
    { _id: user._id },
    {
      password: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      refreshTokenHash: hashToken(refresh.token), // only THIS device's new token is valid
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
  );

  setRefreshCookie(res, refresh.token, rememberMe ? refresh.expiresAt : undefined);
  res.json({
    user: user.toJSON(),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    message: 'Password changed. You have been logged out on all other devices.',
  });
}
