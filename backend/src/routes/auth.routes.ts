import { Router } from 'express';
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { honeypot } from '../middleware/honeypot.js';
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  honeypot(201, { message: 'Account created. Please log in.' }),
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
