import { z } from 'zod'
import { SELF_REGISTER_ROLES } from '@/lib/roles'

// Client-side copies of the backend rules (backend/src/validators/auth.schema.ts),
// so mistakes are shown instantly without a server round trip. The backend
// still validates everything; these only improve the experience.
const email = z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email'))
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

// "Passwords match" check. `when` makes it run even if OTHER fields are
// invalid (by default zod skips object-level checks until every field
// passes), so all errors are shown together.
const passwordsMatch = {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
  when: (payload: { value: unknown }) => {
    const v = payload.value as { password?: unknown; confirmPassword?: unknown }
    return typeof v.password === 'string' && typeof v.confirmPassword === 'string' && v.confirmPassword !== ''
  },
}

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(SELF_REGISTER_ROLES, { error: 'Please choose your role' }),
    acceptTerms: z.literal(true, { error: 'Please accept the Terms and Privacy Policy' }),
    website: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch)

export const forgotPasswordSchema = z.object({ email, website: z.string() })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string().min(1, 'Please confirm your password') })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch)

export const acceptInviteSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, { error: 'Please accept the Terms and Privacy Policy' }),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch)

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch)
  .refine((v) => !v.password || v.password !== v.currentPassword, {
    path: ['password'],
    message: 'Choose a password different from your current one',
  })

export type FieldErrors = Record<string, string>

// Runs a schema and returns the first error message per field ({} if valid).
export function validateForm(schema: z.ZodType, values: unknown): FieldErrors {
  const result = schema.safeParse(values)
  if (result.success) return {}
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= issue.message
  }
  return errors
}
