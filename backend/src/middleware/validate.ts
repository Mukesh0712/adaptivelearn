import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// Validates req.body against a zod schema. On success, req.body is replaced
// with the parsed (trimmed, typed) data; on failure → 400 with field errors.
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      throw ApiError.badRequest('Validation failed', z.flattenError(result.error).fieldErrors);
    }
    req.body = result.data;
    next();
  };
