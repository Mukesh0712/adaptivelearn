import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { listUsers } from '../controllers/admin.controller.js';

// Admin-only endpoints. Every route requires a logged-in, active admin.
export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/users', listUsers);
