import type { Context, Next } from 'hono';
import { v4 as uuid } from 'uuid';

export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    const requestId = c.req.header('x-request-id') ?? uuid();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    await next();
  };
}
