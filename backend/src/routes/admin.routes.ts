import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createInvite, listAuditLogs, listUsers } from '../controllers/admin.controller.js';
import { validate } from '../middleware/validate.js';
import { inviteSchema } from '../validators/admin.schema.js';

// Admin-only endpoints. Every route requires a logged-in, active admin.
export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/users', listUsers);
adminRouter.post('/invites', validate(inviteSchema), createInvite);
adminRouter.get('/audit-logs', listAuditLogs);
