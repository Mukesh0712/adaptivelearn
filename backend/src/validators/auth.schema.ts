import { z } from 'zod';
import { SELF_REGISTER_ROLES } from '../models/User.js';

// Keep these rules in sync with frontend/src/features/auth/schemas.ts.
// Trim BEFORE checking the format: z.email() runs first otherwise, so an
// email with a stray space (common with phone autocomplete) would be rejected.
export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
const newPassword = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters'); // bcrypt ignores bytes past 72

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email,
  password: newPassword,
  role: z.enum(SELF_REGISTER_ROLES, { error: 'Role must be student or parent' }),
  acceptTerms: z.literal(true, { error: 'You must accept the Terms and Privacy Policy' }),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid'),
  password: newPassword,
});

// Opened from an Admin's invite email: /accept-invite?token=<64 hex chars>
const linkToken = z.string().regex(/^[a-f0-9]{64}$/, 'This invite link is invalid');

export const inviteTokenQuerySchema = z.object({ token: linkToken });

export const acceptInviteSchema = z.object({
  token: linkToken,
  password: newPassword,
  acceptTerms: z.literal(true, { error: 'You must accept the Terms and Privacy Policy' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
