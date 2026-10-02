import { z } from 'zod'
import { ASSIGNABLE_ROLES } from './types'

// Client-side copy of inviteSchema in backend/src/validators/admin.schema.ts.
export const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email')),
  role: z.enum(ASSIGNABLE_ROLES, { error: 'Choose a role' }),
})
