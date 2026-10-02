import type { Request, Response } from 'express';
import type { QueryFilter } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel, type User } from '../models/User.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { parseOrThrow } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { generateLinkToken, hashToken } from '../utils/tokens.js';
import {
  auditLogQuerySchema,
  listUsersQuerySchema,
  type InviteInput,
} from '../validators/admin.schema.js';

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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Creates an "invited" account and emails the person a link to set their
// password. The link is also returned to the Admin, so it can be shared
// another way (e.g. WhatsApp) if the email doesn't arrive.
export async function createInvite(req: Request, res: Response) {
  const { name, email, role } = req.body as InviteInput;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw ApiError.conflict(
      existing.status === 'invited'
        ? 'This person has already been invited and has not accepted yet'
        : 'An account with this email already exists',
    );
  }

  const admin = await UserModel.findById(req.user!.id);
  const token = generateLinkToken();
  const now = new Date();
  // If two Admins invite the same email at the same moment, the unique email
  // index rejects the second one (→ 409 in errorHandler).
  const user = await UserModel.create({
    name,
    email,
    role,
    status: 'invited',
    inviteTokenHash: hashToken(token), // only the hash is stored
    inviteExpiresAt: new Date(now.getTime() + env.INVITE_TTL_HOURS * 3_600_000),
    invitedBy: req.user!.id,
    invitedAt: now,
  });

  const inviteLink = `${env.CLIENT_ORIGIN}/accept-invite?token=${token}`;
  // Awaited (unlike password-reset emails): this is an Admin-only action, and
  // the Admin needs to know whether the email actually went out.
  let emailSent = true;
  try {
    await sendInviteEmail(email, name, capitalize(role), admin?.name ?? 'An administrator', inviteLink);
  } catch (err) {
    emailSent = false;
    console.error(`Email: FAILED to send invite to ${email}:`, err instanceof Error ? err.message : err);
  }

  await audit(req.user!.id, 'user.invited', user._id, { name, email, role, emailSent });

  res.status(201).json({
    user: user.toJSON(),
    inviteLink,
    expiresAt: user.inviteExpiresAt,
    emailSent,
    message: emailSent
      ? `Invite sent to ${email}`
      : `The invite was created, but the email could not be sent. Copy the link and share it with ${name}.`,
  });
}

// Newest audit entries for the Admin dashboard's "Recent activity".
export async function listAuditLogs(req: Request, res: Response) {
  const { limit } = parseOrThrow(auditLogQuerySchema, req.query);
  const logs = await AuditLogModel.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    // Replace the actor/target ids with their current name and email.
    .populate('actor', 'name email role')
    .populate('target', 'name email role');
  res.json({ logs: logs.map((l) => l.toJSON()) });
}
