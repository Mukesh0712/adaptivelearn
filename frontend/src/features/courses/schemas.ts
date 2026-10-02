import { z } from 'zod'

// Client-side copy of createCourseSchema in backend/src/validators/course.schema.ts.
export const courseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  code: z
    .string()
    .trim()
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Za-z0-9 -]*$/, 'Use only letters, numbers, spaces and dashes'),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters'),
})

// Admin creating a course for someone: also choose the instructor.
export const adminCourseSchema = courseSchema.extend({
  instructorId: z.string().min(1, 'Choose an instructor'),
})
