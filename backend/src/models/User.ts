import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['student', 'instructor', 'parent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Roles anyone can pick on the public sign-up form. Instructors are invited
// by an Admin and admins are created with the seed script; allowing either
// here would let anyone give themselves staff permissions.
export const SELF_REGISTER_ROLES = ['student', 'parent'] as const;

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
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'student' },
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
        return ret;
      },
    },
  },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
