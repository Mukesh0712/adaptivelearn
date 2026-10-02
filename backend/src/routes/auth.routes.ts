import { Router } from 'express';
import {
  acceptInvite,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
  verifyInvite,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { honeypot } from '../middleware/honeypot.js';
import {
  inviteLimiter,
  loginLimiter,
  passwordResetLimiter,
  registerLimiter,
} from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  // Bots get the same reply as a real sign-up, so they can't tell they were caught.
  honeypot(201, {
    pending: true,
    message: "Thanks! Your account was created and is waiting for an administrator's approval. We'll email you as soon as it's approved.",
  }),
  validate(registerSchema),
  register,
);
authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  honeypot(200, { message: 'If an account exists for that email, we have sent a password reset link.' }),
  validate(forgotPasswordSchema),
  forgotPassword,
);
authRouter.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), resetPassword);
// Public: opened from an Admin's invite email.
authRouter.get('/invite', inviteLimiter, verifyInvite);
authRouter.post('/accept-invite', inviteLimiter, validate(acceptInviteSchema), acceptInvite);
