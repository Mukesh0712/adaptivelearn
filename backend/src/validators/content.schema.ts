import { z } from 'zod';
import { LESSON_STATUSES } from '../models/Lesson.js';
import { parseVideoUrl, recordingPlatform } from '../utils/videoUrl.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/);

export const contentParamsSchema = z.object({
  courseId: objectId,
  moduleId: objectId.optional(),
  lessonId: objectId.optional(),
  resourceId: objectId.optional(),
});

export const moduleSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
});
export type ModuleInput = z.infer<typeof moduleSchema>;

export const newLessonSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
});
export type NewLessonInput = z.infer<typeof newLessonSchema>;

// PATCH a lesson: only the fields sent are changed (no defaults here, or
// unsent fields would be wiped; see the course schema for the same lesson).
export const updateLessonSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
    content: z.string().max(50_000, 'Lesson text must be at most 50,000 characters'),
    status: z.enum(LESSON_STATUSES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// PUT …/order  { ids: [...] } : the complete new order.
export const orderSchema = z.object({
  ids: z.array(objectId).min(1).max(500),
});
export type OrderInput = z.infer<typeof orderSchema>;

// POST …/lessons/:lessonId/resources : add a video or a link.
const resourceTitle = z.string().trim().max(150, 'Title must be at most 150 characters').default('');
const resourceUrl = z.string().trim().min(1, 'Paste a link').max(2000, 'That link is too long');
export const newResourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('video'),
    title: resourceTitle,
    url: resourceUrl.refine((u) => parseVideoUrl(u) !== null, 'Paste a YouTube, Vimeo or Google Drive video link'),
  }),
  z.object({
    kind: z.literal('link'),
    title: resourceTitle,
    url: resourceUrl.refine((u) => {
      try {
        const { protocol, hostname } = new URL(u);
        return (protocol === 'https:' || protocol === 'http:') && hostname.includes('.');
      } catch {
        return false;
      }
    }, 'Enter a full web address, starting with https://'),
    // Zoom recordings only: the passcode students need to watch it.
    passcode: z.string().trim().max(50, 'Passcode must be at most 50 characters').optional(),
  }).refine((v) => !v.passcode || recordingPlatform(v.url) === 'zoom', {
    message: 'A passcode can only be added to a Zoom recording link',
    path: ['passcode'],
  }),
]);
export type NewResourceInput = z.infer<typeof newResourceSchema>;

// PUT …/lessons/:lessonId/progress  { done } : a student marks a lesson done (or not).
export const progressSchema = z.object({ done: z.boolean({ error: 'done must be true or false' }) });
export type ProgressInput = z.infer<typeof progressSchema>;
