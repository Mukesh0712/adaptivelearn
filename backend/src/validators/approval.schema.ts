import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/);

// POST /api/approvals/approve|reject  { ids: [...] }  (1 to 100 people at once)
export const approvalIdsSchema = z.object({
  ids: z
    .array(objectId, { error: 'Select at least one person' })
    .min(1, 'Select at least one person')
    .max(100, 'Select at most 100 people at once')
    .transform((ids) => [...new Set(ids)]), // the same person twice counts once
});
export type ApprovalIdsInput = z.infer<typeof approvalIdsSchema>;

// GET /api/approvals?page=&pageSize=
export const approvalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
