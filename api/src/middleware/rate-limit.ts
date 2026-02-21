import type { Context, Next } from 'hono';
import { rateLimited, errorResponse } from '../lib/errors.js';
import type { VisibilityTier } from '../types.js';

const TIER_LIMITS: Record<VisibilityTier, number> = {
  public: 20,
  buyer: 50,
  auditor: 100,
  owner: 200,
};

interface SlidingWindowEntry {
  timestamps: number[];
  lastCleanup: number;
}

const store = new Map<string, SlidingWindowEntry>();

const GLOBAL_CLEANUP_INTERVAL_MS = 60_000;
let lastGlobalCleanup = Date.now();

function globalCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastGlobalCleanup < GLOBAL_CLEANUP_INTERVAL_MS) return;
  lastGlobalCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}

function pruneEntry(entry: SlidingWindowEntry, cutoff: number): void {
  const now = Date.now();
  if (now - entry.lastCleanup < 1000 && entry.timestamps.length < 500) return;

  let idx = 0;
  while (idx < entry.timestamps.length && entry.timestamps[idx] < cutoff) {
    idx++;
  }
  if (idx > 0) {
    entry.timestamps = entry.timestamps.slice(idx);
    entry.lastCleanup = now;
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function rateLimitMiddleware(config: RateLimitConfig = { maxRequests: 100, windowMs: 1000 }) {
  return async (c: Context, next: Next) => {
    globalCleanup(config.windowMs);

    const tier = (c.get('tier') as VisibilityTier | undefined) ?? 'public';
    const maxRequests = TIER_LIMITS[tier] ?? config.maxRequests;

    const identity = c.get('sparkIdentity') ?? c.req.header('x-api-key') ?? 'anonymous';
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = store.get(identity);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      store.set(identity, entry);
    }

    pruneEntry(entry, windowStart);

    const currentCount = entry.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetAtSec = Math.ceil((now + config.windowMs) / 1000);

    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    c.header('X-RateLimit-Reset', String(resetAtSec));

    if (currentCount >= maxRequests) {
      const oldestInWindow = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
      const retryAfter = Math.max(1, Math.ceil((oldestInWindow + config.windowMs - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      return errorResponse(c, rateLimited(retryAfter));
    }

    entry.timestamps.push(now);
    await next();
  };
}
