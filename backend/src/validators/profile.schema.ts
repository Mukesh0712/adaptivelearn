import { z } from 'zod';

// PATCH /api/profile
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// POST /api/profile/password
export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Enter your current password' }).min(1, 'Enter your current password'),
    newPassword: z
      .string({ error: 'Choose a new password' })
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters'),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
