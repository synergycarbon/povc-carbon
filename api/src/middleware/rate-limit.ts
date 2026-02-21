import type { Context, Next } from 'hono';
import { rateLimited, errorResponse } from '../lib/errors.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function rateLimitMiddleware(config: RateLimitConfig = { maxRequests: 100, windowMs: 1000 }) {
  return async (c: Context, next: Next) => {
    cleanup();

    const identity = c.get('sparkIdentity') ?? c.req.header('x-api-key') ?? 'anonymous';
    const now = Date.now();
    const entry = store.get(identity);

    if (!entry || entry.resetAt < now) {
      store.set(identity, { count: 1, resetAt: now + config.windowMs });
      c.header('X-RateLimit-Limit', String(config.maxRequests));
      c.header('X-RateLimit-Remaining', String(config.maxRequests - 1));
      c.header('X-RateLimit-Reset', String(Math.ceil((now + config.windowMs) / 1000)));
      await next();
      return;
    }

    entry.count++;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return errorResponse(c, rateLimited(retryAfter));
    }

    await next();
  };
}
