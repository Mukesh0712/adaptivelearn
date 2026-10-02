import type { Request, Response } from 'express';
import type { QueryFilter } from 'mongoose';
import { UserModel, type User } from '../models/User.js';
import { parseOrThrow } from '../middleware/validate.js';
import { listUsersQuerySchema } from '../validators/admin.schema.js';

// Escapes regex special characters so a search for "a.b" or "(x" matches that
// text literally instead of being run as a pattern (also prevents a crafted
// search from making MongoDB run a very slow regex).
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lists users for the Admin "Users" page, newest first, one page at a time.
// Search matches part of the name or email, case-insensitively.
export async function listUsers(req: Request, res: Response) {
  const { q, role, status, page, pageSize } = parseOrThrow(listUsersQuerySchema, req.query);

  const filter: QueryFilter<User> = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  if (role) filter.role = role;
  // Accounts saved before statuses existed have no status field: they're active.
  if (status) filter.status = status === 'active' ? { $in: ['active', null] } : status;

  // The page of users and the total count run in parallel (one round trip of waiting).
  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1, _id: -1 }) // _id breaks ties so pages never overlap
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    UserModel.countDocuments(filter),
  ]);

  res.json({
    users: users.map((u) => u.toJSON()),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
