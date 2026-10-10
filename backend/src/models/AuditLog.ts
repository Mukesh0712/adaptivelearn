import { Schema, model, type InferSchemaType } from 'mongoose';
import { env } from '../config/env.js';

// Every action that changes who can use the platform is recorded here:
// who did it (actor), to whom (target), what, and when. Entries are only
// ever added, never edited or deleted, so they form a trustworthy history.
export const AUDIT_ACTIONS = [
  'user.invited',
  'invite.resent',
  'invite.accepted',
  'user.role_changed',
  'user.deactivated',
  'user.reactivated',
  'user.approved',
  'user.rejected',
  'user.erased',
  'course.created',
  'course.archived',
  'course.restored',
  'course.code_reset',
  'course.student_removed',
  'course.reassigned',
  'course.deleted',
  'course.join_approved',
  'course.join_rejected',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    // The user the action was about (null for course actions: the course is
    // named in details, since a course isn't a user).
    target: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // A snapshot of the relevant facts at the time (e.g. the invited name,
    // email and role), so the entry still reads correctly if the user is
    // renamed or their role changes later.
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // entries never change
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// TTL ("time to live") index: MongoDB itself deletes entries once they are
// older than AUDIT_RETENTION_DAYS, so the log can't grow forever and nobody
// has to delete entries by hand. It also serves "newest first" sorting (an
// index can be read in either direction).
// Note: MongoDB keeps the expiry it was created with; after changing
// AUDIT_RETENTION_DAYS on an existing database, update it with collMod.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 });
// "What did this person do?" (the Activity page's person filter).
auditLogSchema.index({ actor: 1, createdAt: -1 });

// Activity page categories → the actions they contain.
export const AUDIT_CATEGORIES = {
  approvals: ['user.approved', 'user.rejected', 'course.join_approved', 'course.join_rejected'],
  invites: ['user.invited', 'invite.resent', 'invite.accepted'],
  accounts: ['user.role_changed', 'user.deactivated', 'user.reactivated', 'user.erased'],
  courses: [
    'course.created',
    'course.archived',
    'course.restored',
    'course.code_reset',
    'course.student_removed',
    'course.reassigned',
    'course.deleted',
  ],
} as const satisfies Record<string, readonly AuditAction[]>;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = model('AuditLog', auditLogSchema);
