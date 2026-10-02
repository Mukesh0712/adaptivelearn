import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['student', 'instructor', 'parent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Roles anyone can pick on the public sign-up form. Instructors are invited
// by an Admin and admins are created with the seed script; allowing either
// here would let anyone give themselves staff permissions.
export const SELF_REGISTER_ROLES = ['student', 'parent'] as const;

// Roles an Admin can invite by email. Admins are never invited (seed script only).
export const INVITE_ROLES = ['instructor'] as const;

// Roles an Admin can switch a user to. Never admin: admin accounts only come
// from the seed script, so an Admin can't promote anyone (or be demoted).
export const ASSIGNABLE_ROLES = ['student', 'parent', 'instructor'] as const;

// active      → can log in.
// invited     → created by an Admin invite; has no password until the invite
//               is accepted, so cannot log in yet.
// deactivated → blocked by an Admin; every request is refused immediately.
// Accounts created before this field existed have no status saved; they are
// treated as active everywhere (the schema default fills it in when loaded).
export const USER_STATUSES = ['active', 'invited', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true, // creates a unique index, so duplicates are rejected by MongoDB itself
      lowercase: true,
      trim: true,
    },
    // select:false → never loaded unless a query explicitly asks for it.
    // Required except for invited users, who choose a password when they accept.
    password: {
      type: String,
      select: false,
      required: function (this: { status?: UserStatus }) {
        return this.status !== 'invited';
      },
    },
    role: { type: String, enum: ROLES, required: true, default: 'student' },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active', index: true },
    lastLoginAt: { type: Date, default: null },
    // Invites (Phase 2): SHA-256 of the emailed invite token + its expiry, and
    // which Admin sent it, when.
    inviteTokenHash: { type: String, select: false, default: null },
    inviteExpiresAt: { type: Date, select: false, default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    invitedAt: { type: Date, default: null },
    // When the user accepted the Terms & Privacy Policy (consent record).
    termsAcceptedAt: { type: Date, default: null },
    // SHA-256 of the user's current refresh token. Lets the server revoke it
    // (logout) and detect reuse of an old one. null = no active session.
    refreshTokenHash: { type: String, select: false, default: null },
    // Forgot-password: SHA-256 of the emailed reset token + when it expires.
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpiresAt: { type: Date, select: false, default: null },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
    toJSON: {
      // Shape of a user whenever it is sent in an API response.
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.resetPasswordTokenHash;
        delete ret.resetPasswordExpiresAt;
        delete ret.inviteTokenHash;
        delete ret.inviteExpiresAt;
        return ret;
      },
    },
  },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
