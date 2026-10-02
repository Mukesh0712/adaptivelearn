import type { Request, Response } from 'express';
import type { QueryFilter } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel, type User, type UserDocument } from '../models/User.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { parseOrThrow } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { generateLinkToken, hashToken } from '../utils/tokens.js';
import {
  auditLogQuerySchema,
  listUsersQuerySchema,
  userIdParamSchema,
  type ChangeRoleInput,
  type ChangeStatusInput,
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

// A fresh invite link: the token goes in the email, only its hash is stored.
function newInvite() {
  const token = generateLinkToken();
  return {
    link: `${env.CLIENT_ORIGIN}/accept-invite?token=${token}`,
    fields: {
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + env.INVITE_TTL_HOURS * 3_600_000),
      invitedAt: new Date(),
    },
  };
}

// Awaited (unlike password-reset emails): this is an Admin-only action, and
// the Admin needs to know whether the email actually went out.
async function emailInvite(user: UserDocument, adminId: string, link: string): Promise<boolean> {
  try {
    const admin = await UserModel.findById(adminId);
    await sendInviteEmail(user.email, user.name, capitalize(user.role), admin?.name ?? 'An administrator', link);
    return true;
  } catch (err) {
    console.error(`Email: FAILED to send invite to ${user.email}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// Same response for a new invite and a resent one. The link is returned to
// the Admin too, so it can be shared another way (e.g. WhatsApp) if the
// email doesn't arrive.
// expiresAt is passed in rather than read from `user`: inviteExpiresAt has
// select:false, so a user loaded back from the database doesn't include it.
const inviteResponse = (user: UserDocument, link: string, expiresAt: Date, emailSent: boolean) => ({
  user: user.toJSON(),
  inviteLink: link,
  expiresAt,
  emailSent,
  message: emailSent
    ? `Invite sent to ${user.email}`
    : `The invite was created, but the email could not be sent. Copy the link and share it with ${user.name}.`,
});

// Creates an "invited" account and emails the person a link to set their password.
export async function createInvite(req: Request, res: Response) {
  const { name, email, role } = req.body as InviteInput;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw ApiError.conflict(
      existing.status === 'invited'
        ? 'This person has already been invited. Use "Resend invite" in the Users list.'
        : 'An account with this email already exists',
    );
  }

  const invite = newInvite();
  // If two Admins invite the same email at the same moment, the unique email
  // index rejects the second one (→ 409 in errorHandler).
  const user = await UserModel.create({
    name,
    email,
    role,
    status: 'invited',
    invitedBy: req.user!.id,
    ...invite.fields,
  });

  const emailSent = await emailInvite(user, req.user!.id, invite.link);
  await audit(req.user!.id, 'user.invited', user._id, { name, email, role, emailSent });
  res.status(201).json(inviteResponse(user, invite.link, invite.fields.inviteExpiresAt, emailSent));
}

// Loads the user an Admin action targets, enforcing the safety rules that
// apply to every such action:
//  - you can't change your own account (no locking yourself out);
//  - admin accounts can't be changed at all. Admins only come from the seed
//    script, and no action can demote or deactivate one, so the number of
//    admins can never drop: the last admin is always safe.
async function manageableUser(req: Request, selectPassword = false): Promise<UserDocument> {
  const { id } = userIdParamSchema.safeParse(req.params).data ?? {};
  if (!id) throw ApiError.notFound('User not found');
  if (id === req.user!.id) throw ApiError.forbidden("You can't change your own account");

  const query = UserModel.findById(id);
  if (selectPassword) query.select('+password'); // only to know whether one was ever set
  const user = await query;
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden("Admin accounts can't be changed here");
  return user;
}

// Every update below is conditional on the state that was just checked (e.g.
// "still invited"), so two Admins clicking at the same moment can't both
// succeed; the second gets a 409 instead of a half-applied change.
const changedMeanwhile = () =>
  ApiError.conflict('This user was changed by someone else. Refresh the list and try again.');

// POST /api/admin/users/:id/resend-invite : new link (the old one stops
// working) with a fresh expiry.
export async function resendInvite(req: Request, res: Response) {
  const user = await manageableUser(req);
  if (user.status !== 'invited') throw ApiError.conflict('Only pending invites can be resent');

  const invite = newInvite();
  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id, status: 'invited' },
    { ...invite.fields, invitedBy: req.user!.id },
    { returnDocument: 'after' },
  );
  if (!updated) throw changedMeanwhile();

  const emailSent = await emailInvite(updated, req.user!.id, invite.link);
  await audit(req.user!.id, 'invite.resent', updated._id, {
    name: updated.name,
    email: updated.email,
    role: updated.role,
    emailSent,
  });
  res.json(inviteResponse(updated, invite.link, invite.fields.inviteExpiresAt, emailSent));
}

// PATCH /api/admin/users/:id/role
// The user is logged out everywhere (refresh token cleared). authenticate
// also refuses their current access token, since its role no longer matches,
// so they're signed out at once and land in their new portal after logging in.
export async function changeRole(req: Request, res: Response) {
  const { role } = req.body as ChangeRoleInput;
  const user = await manageableUser(req);
  if (user.status === 'invited') {
    throw ApiError.conflict("This person hasn't accepted their invite yet, so their role can't be changed");
  }
  if (user.role === role) throw ApiError.badRequest(`${user.name} is already ${capitalize(role)}`);

  const from = user.role;
  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id, role: from },
    { role, refreshTokenHash: null },
    { returnDocument: 'after' },
  );
  if (!updated) throw changedMeanwhile();

  await audit(req.user!.id, 'user.role_changed', updated._id, { name: updated.name, from, to: role });
  res.json({
    user: updated.toJSON(),
    message: `${updated.name} is now ${capitalize(role)}. They've been logged out and will see the ${capitalize(role)} portal next time they log in.`,
  });
}

// PATCH /api/admin/users/:id/status  { status: 'deactivated' | 'active' }
export async function changeStatus(req: Request, res: Response) {
  const { status } = req.body as ChangeStatusInput;
  const user = await manageableUser(req, true);

  if (status === 'deactivated') {
    if (user.status === 'deactivated') throw ApiError.conflict(`${user.name} is already deactivated`);
    const wasInvited = user.status === 'invited';
    // Logs them out everywhere and, for a pending invite, kills the link.
    const updated = await UserModel.findOneAndUpdate(
      { _id: user._id, status: user.status },
      { status: 'deactivated', refreshTokenHash: null, inviteTokenHash: null, inviteExpiresAt: null },
      { returnDocument: 'after' },
    );
    if (!updated) throw changedMeanwhile();
    await audit(req.user!.id, 'user.deactivated', updated._id, { name: updated.name, wasInvited });
    res.json({
      user: updated.toJSON(),
      message: wasInvited
        ? `Invite cancelled for ${updated.name}`
        : `${updated.name} has been deactivated and logged out`,
    });
    return;
  }

  if (user.status !== 'deactivated') throw ApiError.conflict(`${user.name} is already active`);
  // Someone whose invite was cancelled never set a password: they go back to
  // "invited" (send them a new invite) rather than an active account nobody
  // can log in to.
  const next = user.password ? 'active' : 'invited';
  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id, status: 'deactivated' },
    { status: next },
    { returnDocument: 'after' },
  );
  if (!updated) throw changedMeanwhile();
  await audit(req.user!.id, 'user.reactivated', updated._id, { name: updated.name, status: next });
  res.json({
    user: updated.toJSON(),
    message:
      next === 'active'
        ? `${updated.name} has been reactivated and can log in again`
        : `${updated.name} is back to "invited". Use "Resend invite" to send them a new link.`,
  });
}

// Audit entries, newest first, one page at a time. Used by the dashboard's
// "Recent activity" card (first 5) and the full Activity page.
export async function listAuditLogs(req: Request, res: Response) {
  const { page, pageSize } = parseOrThrow(auditLogQuerySchema, req.query);
  const [logs, total] = await Promise.all([
    AuditLogModel.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      // Replace the actor/target ids with their current name and email.
      .populate('actor', 'name email role')
      .populate('target', 'name email role'),
    AuditLogModel.estimatedDocumentCount(), // fast: no filter, so MongoDB reads its stored count
  ]);
  res.json({
    logs: logs.map((l) => l.toJSON()),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
