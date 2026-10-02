import { z } from 'zod';
import { INVITE_ROLES, ROLES, USER_STATUSES } from '../models/User.js';
import { email } from './auth.schema.js';

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
  role: z.enum(INVITE_ROLES, { error: 'Only instructors can be invited' }).default('instructor'),
});
export type InviteInput = z.infer<typeof inviteSchema>;

// GET /api/admin/audit-logs?limit=
export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
