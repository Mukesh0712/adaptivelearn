import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { adminDashboard, instructorDashboard } from '../controllers/dashboard.controller.js';

// Summary data for each portal's dashboard (one request per dashboard).
export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get('/instructor', authorize('instructor'), instructorDashboard);
dashboardRouter.get('/admin', authorize('admin'), adminDashboard);
