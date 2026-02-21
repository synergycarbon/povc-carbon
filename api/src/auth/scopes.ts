import type { ApiScope, JwtClaims } from '../types.js';

export function parseScopes(scopeString: string): ApiScope[] {
  return scopeString.split(' ').filter(Boolean) as ApiScope[];
}

export function hasScope(claims: JwtClaims, required: ApiScope): boolean {
  const scopes = parseScopes(claims.scope);
  return scopes.includes(required);
}

export function hasAllScopes(claims: JwtClaims, required: ApiScope[]): boolean {
  const scopes = parseScopes(claims.scope);
  return required.every((s) => scopes.includes(s));
}

export function hasAnyScope(claims: JwtClaims, required: ApiScope[]): boolean {
  const scopes = parseScopes(claims.scope);
  return required.some((s) => scopes.includes(s));
}

export const ENDPOINT_SCOPES: Record<string, ApiScope> = {
  'GET /api/v1/credits': 'credits:read',
  'GET /api/v1/credits/:credit_id': 'credits:read',
  'POST /api/v1/credits/:credit_id/retire': 'credits:retire',
  'GET /api/v1/attestations': 'attestations:read',
  'GET /api/v1/attestations/:attestation_id': 'attestations:read',
  'GET /api/v1/retirements': 'retirements:read',
  'GET /api/v1/retirements/:retirement_id': 'retirements:read',
  'GET /api/v1/marketplace/listings': 'marketplace:read',
  'POST /api/v1/marketplace/orders': 'marketplace:order',
  'GET /api/v1/contracts': 'contracts:read',
  'GET /api/v1/contracts/:contract_id': 'contracts:read',
  'GET /api/v1/audit/events': 'audit:read',
  'GET /api/v1/audit/export': 'audit:read',
  'GET /api/v1/governance/methodologies': 'governance:read',
  'POST /api/v1/webhooks': 'webhooks:write',
  'GET /api/v1/webhooks': 'webhooks:read',
  'DELETE /api/v1/webhooks/:id': 'webhooks:write',
  'GET /api/v1/webhooks/:id/deliveries': 'webhooks:read',
};
