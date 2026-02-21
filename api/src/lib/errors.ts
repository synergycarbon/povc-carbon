import type { Context } from 'hono';
import { v4 as uuid } from 'uuid';
import type { ErrorResponse, ValidationErrorResponse } from '../types.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(400, 'bad_request', message, details);
}

export function unauthorized(message = 'Missing or invalid Bearer token'): ApiError {
  return new ApiError(401, 'unauthorized', message);
}

export function tokenExpired(): ApiError {
  return new ApiError(401, 'token_expired', 'JWT has expired');
}

export function forbidden(message = 'Insufficient permissions for this operation'): ApiError {
  return new ApiError(403, 'forbidden', message);
}

export function notOwner(): ApiError {
  return new ApiError(403, 'not_owner', 'Caller is not the credit owner or authorized delegate');
}

export function notFound(resource: string): ApiError {
  return new ApiError(404, `${resource}_not_found`, `${resource.replace('_', ' ')} with the specified ID does not exist`);
}

export function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message);
}

export function validationFailed(
  errors: Array<{ field: string; message: string; code?: string }>,
): never {
  const err = new ApiError(422, 'validation_failed', 'Request body failed validation');
  (err as ApiError & { validationErrors: typeof errors }).validationErrors = errors;
  throw err;
}

export function rateLimited(retryAfter: number): ApiError {
  const err = new ApiError(429, 'rate_limited', `Rate limit exceeded. Retry after ${retryAfter} seconds.`);
  (err as ApiError & { retryAfter: number }).retryAfter = retryAfter;
  return err;
}

export function errorResponse(c: Context, err: ApiError): Response {
  const requestId = uuid();

  if (err.code === 'validation_failed') {
    const body: ValidationErrorResponse = {
      error: {
        code: 'validation_failed',
        message: err.message,
        validation_errors: (err as ApiError & { validationErrors?: Array<{ field: string; message: string; code?: string }> }).validationErrors ?? [],
        request_id: requestId,
      },
    };
    return c.json(body, 422);
  }

  if (err.code === 'rate_limited') {
    const retryAfter = (err as ApiError & { retryAfter?: number }).retryAfter ?? 1;
    c.header('Retry-After', String(retryAfter));
  }

  const body: ErrorResponse = {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      request_id: requestId,
    },
  };

  return c.json(body, err.status as 400);
}
