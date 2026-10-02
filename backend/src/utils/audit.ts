import type { Types } from 'mongoose';
import { AuditLogModel, type AuditAction } from '../models/AuditLog.js';

type Id = string | Types.ObjectId;

// Records one audit entry. A failure to write the log is reported in the
// server logs but never undoes or fails the action itself: the invite was
// already sent, and telling the admin "failed" would make them send it twice.
export async function audit(
  actor: Id,
  action: AuditAction,
  target: Id | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await AuditLogModel.create({ actor, action, target, details });
  } catch (err) {
    console.error(`Audit: FAILED to record ${action}:`, err instanceof Error ? err.message : err);
  }
}
