import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// Parses data with a zod schema, or throws a 400 listing the field errors.
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest('Validation failed', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

// Validates req.body against a zod schema. On success, req.body is replaced
// with the parsed (trimmed, typed) data; on failure → 400 with field errors.
// (Query strings are parsed in the controller with parseOrThrow, because
// Express 5 makes req.query read-only.)
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
