import { z } from 'zod';

// POST /api/approvals/approve|reject  { ids: [...] }
export { bulkIdsSchema as approvalIdsSchema, type BulkIdsInput as ApprovalIdsInput } from './common.schema.js';

// GET /api/approvals?page=&pageSize=
export const approvalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
