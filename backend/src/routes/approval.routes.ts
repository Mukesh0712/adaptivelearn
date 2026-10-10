import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { approve, listApprovals, reject } from '../controllers/approval.controller.js';
import { approvalIdsSchema } from '../validators/approval.schema.js';

// Pending sign-ups. Admins see all; instructors see students who asked to
// join their courses (the controller limits each request to that scope).
export const approvalRouter = Router();

approvalRouter.use(authenticate, authorize('admin', 'instructor'));
approvalRouter.get('/', listApprovals);
approvalRouter.post('/approve', validate(approvalIdsSchema), approve);
approvalRouter.post('/reject', validate(approvalIdsSchema), reject);
