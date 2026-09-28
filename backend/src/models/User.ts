import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['student', 'instructor', 'parent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Roles anyone can pick on the public sign-up form. Admins are created only
// via the seed script, otherwise anyone could make themselves an admin.
export const SELF_REGISTER_ROLES = ['student', 'instructor', 'parent'] as const;

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
        return ret;
      },
    },
  },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
