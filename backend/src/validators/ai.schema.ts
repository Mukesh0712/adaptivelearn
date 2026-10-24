import { z } from 'zod';

// POST …/lessons/:lessonId/ai/chat : a question to the study assistant.
// The chat isn't stored on the server: the browser sends the last few
// messages along, so follow-up questions make sense.
export const lessonChatSchema = z.object({
  question: z.string().trim().min(1, 'Type a question').max(500, 'Questions must be at most 500 characters'),
  history: z
    .array(z.object({ role: z.enum(['student', 'assistant']), text: z.string().trim().min(1).max(2000) }))
    .max(6)
    .default([]),
});
export type LessonChatInput = z.infer<typeof lessonChatSchema>;
