import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { changePasswordLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { changePassword, updateProfile } from '../controllers/profile.controller.js';
import { changePasswordSchema, updateProfileSchema } from '../validators/profile.schema.js';

// The logged-in user's own account. Every role may use these.
export const profileRouter = Router();

profileRouter.use(authenticate);
profileRouter.patch('/', validate(updateProfileSchema), updateProfile);
profileRouter.post('/password', changePasswordLimiter, validate(changePasswordSchema), changePassword);
