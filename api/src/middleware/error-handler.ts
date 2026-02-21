import type { Context } from 'hono';
import { ApiError, errorResponse } from '../lib/errors.js';
import { v4 as uuid } from 'uuid';

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return errorResponse(c, err);
  }

  console.error('Unhandled error:', err);

  return c.json(
    {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
        request_id: uuid(),
      },
    },
    500,
  );
}
