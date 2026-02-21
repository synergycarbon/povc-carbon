import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { notFound, conflict, ApiError } from '../lib/errors.js';

const marketplace = new Hono();
const wire = new WireClient();

// GET /api/v1/marketplace/listings — List active marketplace listings
marketplace.get('/listings', requireScope('marketplace:read'), async (c) => {
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const filters: Record<string, unknown> = {};
  if (query.vintage_year) filters.vintage_year = parseInt(query.vintage_year, 10);
  if (query.credit_type) filters.credit_type = query.credit_type;
  if (query.methodology) filters.methodology = query.methodology;
  if (query.source_type) filters.source_type = query.source_type;
  if (query.price_min) filters.price_min = parseFloat(query.price_min);
  if (query.price_max) filters.price_max = parseFloat(query.price_max);
  if (query.min_quantity) filters.min_quantity = parseFloat(query.min_quantity);
  if (query.sort) filters.sort = query.sort;
  if (query.order) filters.order = query.order;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.marketplace.orderbook.v1', 'list_listings', {
    filters,
    cursor: cursorData,
    limit: limit + 1,
  });

  const items = (result as { listings: Record<string, unknown>[] }).listings;
  const response = buildPaginatedResponse(items, limit, 'listing_id');

  return c.json(response);
});

// POST /api/v1/marketplace/orders — Place a marketplace order
marketplace.post('/orders', requireScope('marketplace:order'), async (c) => {
  const sparkIdentity = c.get('sparkIdentity');
  const idempotencyKey = c.req.header('idempotency-key');

  const body = await c.req.json<{
    listing_id: string;
    quantity_tonnes: number;
    max_price_per_tonne?: number;
    auto_retire?: boolean;
    retirement_reason?: string;
    beneficiary_name?: string;
    metadata?: Record<string, unknown>;
  }>();

  const validationErrors: Array<{ field: string; message: string; code: string }> = [];
  if (!body.listing_id) {
    validationErrors.push({ field: 'listing_id', message: 'Field is required', code: 'required' });
  }
  if (!body.quantity_tonnes || body.quantity_tonnes < 0.001) {
    validationErrors.push({ field: 'quantity_tonnes', message: 'Must be >= 0.001', code: 'minimum' });
  }
  if (body.auto_retire && !body.retirement_reason) {
    validationErrors.push({ field: 'retirement_reason', message: 'Required when auto_retire is true', code: 'required' });
  }

  if (validationErrors.length > 0) {
    throw Object.assign(
      new ApiError(422, 'validation_failed', 'Request body failed validation'),
      { validationErrors },
    );
  }

  try {
    const result = await wire.invoke('sc.marketplace.orderbook.v1', 'place_order', {
      buyer: sparkIdentity,
      listing_id: body.listing_id,
      quantity_tonnes: body.quantity_tonnes,
      max_price_per_tonne: body.max_price_per_tonne,
      auto_retire: body.auto_retire ?? false,
      retirement_reason: body.retirement_reason,
      beneficiary_name: body.beneficiary_name,
      metadata: body.metadata,
      idempotency_key: idempotencyKey,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not_found')) throw notFound('listing');
    if (message.includes('unavailable') || message.includes('sold') || message.includes('expired')) {
      throw conflict('listing_unavailable', 'Listing is no longer available (sold or expired)');
    }
    throw err;
  }
});

export { marketplace };
