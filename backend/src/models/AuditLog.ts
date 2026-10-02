import { Schema, model, type InferSchemaType } from 'mongoose';

// Every action that changes who can use the platform is recorded here:
// who did it (actor), to whom (target), what, and when. Entries are only
// ever added, never edited or deleted, so they form a trustworthy history.
export const AUDIT_ACTIONS = ['user.invited', 'invite.accepted'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
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

// The dashboard asks for "newest first"; this index makes that a fast scan.
auditLogSchema.index({ createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = model('AuditLog', auditLogSchema);
