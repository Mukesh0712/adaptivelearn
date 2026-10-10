import type { Request, Response } from 'express';
import type { QueryFilter, Types } from 'mongoose';
import { env } from '../config/env.js';
import { CourseModel } from '../models/Course.js';
import { UserModel, type User } from '../models/User.js';
import { parseOrThrow } from '../middleware/validate.js';
import { audit } from '../utils/audit.js';
import { sendApprovalEmail } from '../utils/mailer.js';
import { approvalListQuerySchema, type ApprovalIdsInput } from '../validators/approval.schema.js';
import { enrollStudent } from './course.controller.js';

// Which pending sign-ups the logged-in user may decide on:
//  - an admin: all of them (students and parents);
//  - an instructor: only students who asked to join one of THEIR active courses.
// Every list, approval and rejection below is limited by this filter, so an
// instructor can never approve someone outside their own classes.
async function scope(req: Request): Promise<QueryFilter<User>> {
  if (req.user!.role === 'admin') return { status: 'pending' };
  const courses = await CourseModel.find({ instructor: req.user!.id, status: 'active' }).select('_id');
  return { status: 'pending', role: 'student', requestedCourse: { $in: courses.map((c) => c._id) } };
}

// GET /api/approvals : pending sign-ups in scope, oldest first (fair queue).
export async function listApprovals(req: Request, res: Response) {
  const { page, pageSize } = parseOrThrow(approvalListQuerySchema, req.query);
  const filter = await scope(req);
  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate<{ requestedCourse: { _id: Types.ObjectId; title: string } | null }>('requestedCourse', 'title'),
    UserModel.countDocuments(filter),
  ]);
  res.json({
    requests: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.get('createdAt'),
      course: u.requestedCourse ? { id: String(u.requestedCourse._id), title: u.requestedCourse.title } : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

type Outcome = 'done' | 'already_handled' | 'not_allowed';

// Why a conditional update matched nothing: someone else already decided
// (approved, or rejected = removed), or it isn't this user's to decide.
async function explain(id: string): Promise<{ outcome: Outcome; by?: string }> {
  const current = await UserModel.findById(id).populate<{ approvedBy: { name: string } | null }>('approvedBy', 'name');
  if (!current) return { outcome: 'already_handled' }; // rejected meanwhile
  if (current.status !== 'pending') {
    return { outcome: 'already_handled', ...(current.approvedBy ? { by: current.approvedBy.name } : {}) };
  }
  return { outcome: 'not_allowed' };
}

// "3 approved. 1 was already handled by someone else."
function summary(verb: string, results: { outcome: Outcome }[]) {
  const n = (o: Outcome) => results.filter((r) => r.outcome === o).length;
  const parts = [`${n('done')} ${verb}`];
  if (n('already_handled')) parts.push(`${n('already_handled')} already handled by someone else`);
  if (n('not_allowed')) parts.push(`${n('not_allowed')} not yours to decide`);
  return parts.join(' · ');
}

// POST /api/approvals/approve  { ids }
// Each person is approved with ONE conditional update: "set active WHERE
// still pending AND in my scope". If the admin and the instructor click at
// the same moment, exactly one update matches; the other gets
// "already handled". Nothing is half-applied, nobody is approved twice.
export async function approve(req: Request, res: Response) {
  const { ids } = req.body as ApprovalIdsInput;
  const filter = await scope(req);
  const results: { id: string; outcome: Outcome; by?: string }[] = [];
  const toEmail: { email: string; name: string }[] = [];

  for (const id of ids) {
    const user = await UserModel.findOneAndUpdate(
      { ...filter, _id: id },
      { status: 'active', approvedBy: req.user!.id, approvedAt: new Date() },
      { returnDocument: 'after' },
    ).populate<{ requestedCourse: { _id: Types.ObjectId; title: string } | null }>('requestedCourse', 'title');
    if (!user) {
      results.push({ id, ...(await explain(id)) });
      continue;
    }
    // Approving a student who named a class also enrols them in it.
    const enrolled = user.requestedCourse ? await enrollStudent(user.requestedCourse._id, user._id) : false;
    await audit(req.user!.id, 'user.approved', user._id, {
      name: user.name,
      role: user.role,
      ...(enrolled ? { title: user.requestedCourse!.title } : {}),
    });
    toEmail.push({ email: user.email, name: user.name });
    results.push({ id, outcome: 'done' });
  }

  // Emails go out together at the end; one failure doesn't stop the others.
  const sent = await Promise.allSettled(
    toEmail.map((u) => sendApprovalEmail(u.email, u.name, `${env.CLIENT_ORIGIN}/login`)),
  );
  sent.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Email: FAILED to send approval to ${toEmail[i]!.email}`);
  });
  res.json({ results, message: summary('approved', results) });
}

// POST /api/approvals/reject  { ids }
// Removes pending sign-ups (they have no data yet; the audit log keeps a
// record, and the person can register again if it was a mistake).
export async function reject(req: Request, res: Response) {
  const { ids } = req.body as ApprovalIdsInput;
  const filter = await scope(req);
  const results: { id: string; outcome: Outcome; by?: string }[] = [];

  for (const id of ids) {
    const removed = await UserModel.findOneAndDelete({ ...filter, _id: id });
    if (!removed) {
      results.push({ id, ...(await explain(id)) });
      continue;
    }
    await audit(req.user!.id, 'user.rejected', null, { name: removed.name, email: removed.email, role: removed.role });
    results.push({ id, outcome: 'done' });
  }
  res.json({ results, message: summary('rejected', results) });
}
