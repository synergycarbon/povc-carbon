import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { filterFields, filterFieldsArray } from '../lib/visibility.js';
import { notFound, conflict, notOwner, ApiError } from '../lib/errors.js';
import type { VisibilityTier } from '../types.js';

const credits = new Hono();
const wire = new WireClient();

// GET /api/v1/credits — List carbon credits
credits.get('/', requireScope('credits:read'), async (c) => {
  const tier = c.get('tier') as VisibilityTier;
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const filters: Record<string, unknown> = {};
  if (query.status) filters.status = query.status;
  if (query.vintage_year) filters.vintage_year = parseInt(query.vintage_year, 10);
  if (query.vintage_year_min) filters.vintage_year_min = parseInt(query.vintage_year_min, 10);
  if (query.vintage_year_max) filters.vintage_year_max = parseInt(query.vintage_year_max, 10);
  if (query.credit_type) filters.credit_type = query.credit_type;
  if (query.methodology) filters.methodology = query.methodology;
  if (query.project_id) filters.project_id = query.project_id;
  if (query.owner) filters.owner = query.owner;
  if (query.sort) filters.sort = query.sort;
  if (query.order) filters.order = query.order;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.core.credit_registry.v1', 'list', {
    filters,
    cursor: cursorData,
    limit: limit + 1, // fetch one extra to detect has_more
    caller_tier: tier,
  });

  const items = (result as { credits: Record<string, unknown>[] }).credits;
  const filtered = filterFieldsArray(items, 'credit', tier);
  const response = buildPaginatedResponse(filtered, limit, 'credit_id');

  return c.json(response);
});

// GET /api/v1/credits/:credit_id — Get credit details
credits.get('/:credit_id', requireScope('credits:read'), async (c) => {
  const tier = c.get('tier') as VisibilityTier;
  const creditId = c.req.param('credit_id');

  const result = await wire.invoke('sc.core.credit_registry.v1', 'get', {
    credit_id: creditId,
    caller_tier: tier,
  });

  if (!result) {
    throw notFound('credit');
  }

  const data = filterFields(result as Record<string, unknown>, 'credit', tier);
  return c.json({ data });
});

// POST /api/v1/credits/:credit_id/retire — Retire a credit
credits.post('/:credit_id/retire', requireScope('credits:retire'), async (c) => {
  const creditId = c.req.param('credit_id');
  const sparkIdentity = c.get('sparkIdentity');
  const idempotencyKey = c.req.header('idempotency-key');

  const body = await c.req.json<{
    retirement_reason: string;
    beneficiary_name?: string;
    beneficiary_id?: string;
    metadata?: Record<string, unknown>;
  }>();

  const validationErrors: Array<{ field: string; message: string; code: string }> = [];
  if (!body.retirement_reason || body.retirement_reason.length === 0) {
    validationErrors.push({ field: 'retirement_reason', message: 'Field is required', code: 'required' });
  } else if (body.retirement_reason.length > 500) {
    validationErrors.push({ field: 'retirement_reason', message: 'Must be 500 characters or fewer', code: 'max_length' });
  }
  if (body.beneficiary_name && body.beneficiary_name.length > 200) {
    validationErrors.push({ field: 'beneficiary_name', message: 'Must be 200 characters or fewer', code: 'max_length' });
  }

  if (validationErrors.length > 0) {
    throw Object.assign(
      new ApiError(422, 'validation_failed', 'Request body failed validation'),
      { validationErrors },
    );
  }

  try {
    const result = await wire.invoke('sc.core.retirement_engine.v1', 'retire', {
      credit_id: creditId,
      caller: sparkIdentity,
      retirement_reason: body.retirement_reason,
      beneficiary_name: body.beneficiary_name,
      beneficiary_id: body.beneficiary_id,
      metadata: body.metadata,
      idempotency_key: idempotencyKey,
    });

    return c.json({ data: result }, 200);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not_owner')) throw notOwner();
    if (message.includes('not_found')) throw notFound('credit');
    if (message.includes('not_retirable')) throw conflict('credit_not_retirable', 'Credit is already retired or in a non-retirable state');
    throw err;
  }
});

export { credits };
