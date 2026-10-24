import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { myMastery } from '../controllers/adaptive.controller.js';

// Adaptive learning (Phase 9), mounted at /api/courses/:courseId like the
// content and quiz routes. authenticate is per route for the same reason as
// in content.routes.ts.
export const adaptiveRouter = Router({ mergeParams: true });

adaptiveRouter.get('/mastery/me', authenticate, myMastery);
