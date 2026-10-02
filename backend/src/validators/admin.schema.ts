import { z } from 'zod';
import { ASSIGNABLE_ROLES, INVITE_ROLES, ROLES, USER_STATUSES } from '../models/User.js';
import { email } from './auth.schema.js';
import { COURSE_STATUSES } from '../models/Course.js';

// GET /api/admin/users?q=&role=&status=&page=&pageSize=
// Query string values always arrive as text, so numbers are coerced.
// An empty value (e.g. "role=") means "no filter".
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const listUsersQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  role: z.preprocess(emptyToUndefined, z.enum(ROLES).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(USER_STATUSES).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// POST /api/admin/invites
export const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email,
  role: z.enum(INVITE_ROLES, { error: 'Role must be student, parent or instructor' }),
});
export type InviteInput = z.infer<typeof inviteSchema>;

// GET /api/admin/audit-logs?page=&pageSize=
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// /api/admin/users/:id : a MongoDB ObjectId (24 hex characters). Checked up
// front so a malformed id is a clean 404, not a database cast error (500).
export const userIdParamSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });

// PATCH /api/admin/users/:id/role
export const changeRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES, { error: 'Role must be student, parent or instructor' }),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

// PATCH /api/admin/users/:id/status
export const changeStatusSchema = z.object({
  status: z.enum(['active', 'deactivated'], { error: 'Status must be active or deactivated' }),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// GET /api/admin/courses?q=&status=&page=&pageSize=
export const listCoursesQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(COURSE_STATUSES).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
