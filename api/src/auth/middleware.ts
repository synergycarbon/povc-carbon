import type { Context, Next } from 'hono';
import { verifyMlDsaJwt } from './jwt.js';
import { hasScope } from './scopes.js';
import type { ApiScope, JwtClaims, VisibilityTier } from '../types.js';
import { unauthorized, tokenExpired, forbidden } from '../lib/errors.js';

declare module 'hono' {
  interface ContextVariableMap {
    claims: JwtClaims;
    tier: VisibilityTier;
    sparkIdentity: string;
    requestId: string;
  }
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw unauthorized();
    }

    const token = authHeader.slice(7);
    const result = await verifyMlDsaJwt(token);

    if (!result.valid || !result.claims) {
      if (result.error?.includes('expired')) {
        throw tokenExpired();
      }
      throw unauthorized(result.error ?? 'Invalid token');
    }

    c.set('claims', result.claims);
    c.set('tier', result.claims.tier);
    c.set('sparkIdentity', result.claims.sub);

    await next();
  };
}

export function requireScope(scope: ApiScope) {
  return async (c: Context, next: Next) => {
    const claims = c.get('claims');
    if (!claims) {
      throw unauthorized();
    }
    if (!hasScope(claims, scope)) {
      throw forbidden(`Missing required scope: ${scope}`);
    }
    await next();
  };
}

export function requireTier(minimumTier: VisibilityTier) {
  const tierLevels: Record<VisibilityTier, number> = {
    public: 0,
    buyer: 1,
    auditor: 2,
    owner: 3,
  };

  return async (c: Context, next: Next) => {
    const tier = c.get('tier');
    if (!tier || tierLevels[tier] < tierLevels[minimumTier]) {
      throw forbidden(`Requires ${minimumTier} tier or higher`);
    }
    await next();
  };
}
