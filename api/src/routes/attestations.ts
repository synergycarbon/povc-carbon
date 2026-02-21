import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { filterFields, filterFieldsArray } from '../lib/visibility.js';
import { notFound } from '../lib/errors.js';
import type { VisibilityTier } from '../types.js';

const attestations = new Hono();
const wire = new WireClient();

// GET /api/v1/attestations — List verified attestations
attestations.get('/', requireScope('attestations:read'), async (c) => {
  const tier = c.get('tier') as VisibilityTier;
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const filters: Record<string, unknown> = {};
  if (query.project_id) filters.project_id = query.project_id;
  if (query.tenant_id) filters.tenant_id = query.tenant_id;
  if (query.methodology) filters.methodology = query.methodology;
  if (query.verified_after) filters.verified_after = query.verified_after;
  if (query.verified_before) filters.verified_before = query.verified_before;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.core.povcr_verifier.v1', 'list', {
    filters,
    cursor: cursorData,
    limit: limit + 1,
    caller_tier: tier,
  });

  const items = (result as { attestations: Record<string, unknown>[] }).attestations;
  const filtered = filterFieldsArray(items, 'attestation', tier);
  const response = buildPaginatedResponse(filtered, limit, 'attestation_id');

  return c.json(response);
});

// GET /api/v1/attestations/:attestation_id — Get attestation details
attestations.get('/:attestation_id', requireScope('attestations:read'), async (c) => {
  const tier = c.get('tier') as VisibilityTier;
  const attestationId = c.req.param('attestation_id');

  const result = await wire.invoke('sc.core.povcr_verifier.v1', 'get', {
    attestation_id: attestationId,
    caller_tier: tier,
  });

  if (!result) {
    throw notFound('attestation');
  }

  const data = filterFields(result as Record<string, unknown>, 'attestation', tier);
  return c.json({ data });
});

export { attestations };
