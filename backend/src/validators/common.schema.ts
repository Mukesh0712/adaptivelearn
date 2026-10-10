import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/);

// Bulk actions: { ids: [...] }, 1 to 100 people at once. The same person
// listed twice counts once.
export const bulkIdsSchema = z.object({
  ids: z
    .array(objectId, { error: 'Select at least one person' })
    .min(1, 'Select at least one person')
    .max(100, 'Select at most 100 people at once')
    .transform((ids) => [...new Set(ids)]),
});
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;
