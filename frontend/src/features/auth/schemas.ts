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

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(SELF_REGISTER_ROLES),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string().min(1, 'Please confirm your password') })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
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
