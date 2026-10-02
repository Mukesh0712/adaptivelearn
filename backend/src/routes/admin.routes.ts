import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  changeRole,
  changeStatus,
  createInvite,
  listAuditLogs,
  listUsers,
  resendInvite,
} from '../controllers/admin.controller.js';
import { validate } from '../middleware/validate.js';
import { listAllCourses, setAnyCourseStatus } from '../controllers/adminCourse.controller.js';
import { courseStatusSchema } from '../validators/course.schema.js';
import { changeRoleSchema, changeStatusSchema, inviteSchema } from '../validators/admin.schema.js';

// Admin-only endpoints. Every route requires a logged-in, active admin.
export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/users', listUsers);
adminRouter.post('/invites', validate(inviteSchema), createInvite);
adminRouter.get('/audit-logs', listAuditLogs);
adminRouter.post('/users/:id/resend-invite', resendInvite);
adminRouter.patch('/users/:id/role', validate(changeRoleSchema), changeRole);
adminRouter.patch('/users/:id/status', validate(changeStatusSchema), changeStatus);
adminRouter.get('/courses', listAllCourses);
adminRouter.patch('/courses/:id/status', validate(courseStatusSchema), setAnyCourseStatus);
