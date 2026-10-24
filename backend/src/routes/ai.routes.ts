import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { aiMe } from '../controllers/ai.controller.js';

// AI features that aren't tied to one course.
export const aiRouter = Router();

aiRouter.get('/me', authenticate, aiMe);
