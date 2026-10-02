import { z } from 'zod';
import { ROLES, USER_STATUSES } from '../models/User.js';

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
