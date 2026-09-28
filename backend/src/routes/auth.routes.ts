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
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
authRouter.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), resetPassword);
