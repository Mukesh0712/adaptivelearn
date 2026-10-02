import { z } from 'zod';

const title = z.string().trim().min(3, 'Title must be at least 3 characters').max(120);
const code = z
  .string()
  .trim()
  .max(20, 'Code must be at most 20 characters')
  .regex(/^[A-Za-z0-9 -]*$/, 'Use only letters, numbers, spaces and dashes');
const description = z.string().trim().max(1000, 'Description must be at most 1000 characters');

// POST /api/courses
// Defaults belong here only: on the update schema below, a default would
// fill in '' for every field NOT sent and wipe it.
export const createCourseSchema = z.object({ title, code: code.default(''), description: description.default('') });
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

// PATCH /api/courses/:id  (only the fields sent are changed)
export const updateCourseSchema = z
  .object({ title, code, description })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

// PATCH /api/courses/:id/status
export const courseStatusSchema = z.object({
  status: z.enum(['active', 'archived'], { error: 'Status must be active or archived' }),
});
export type CourseStatusInput = z.infer<typeof courseStatusSchema>;

// :id in the URL must be a MongoDB ObjectId.
export const courseIdParamSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) });
