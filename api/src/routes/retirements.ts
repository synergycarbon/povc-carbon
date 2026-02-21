import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { notFound } from '../lib/errors.js';

const retirements = new Hono();
const wire = new WireClient();

// GET /api/v1/retirements — List retirement records
retirements.get('/', requireScope('retirements:read'), async (c) => {
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const filters: Record<string, unknown> = {};
  if (query.retired_by) filters.retired_by = query.retired_by;
  if (query.project_id) filters.project_id = query.project_id;
  if (query.retired_after) filters.retired_after = query.retired_after;
  if (query.retired_before) filters.retired_before = query.retired_before;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.core.retirement_engine.v1', 'list', {
    filters,
    cursor: cursorData,
    limit: limit + 1,
  });

  const items = (result as { retirements: Record<string, unknown>[] }).retirements;
  const response = buildPaginatedResponse(items, limit, 'retirement_id');

  return c.json(response);
});

// GET /api/v1/retirements/:retirement_id — Get retirement details + certificate
retirements.get('/:retirement_id', requireScope('retirements:read'), async (c) => {
  const retirementId = c.req.param('retirement_id');

  const result = await wire.invoke('sc.core.retirement_engine.v1', 'get_detail', {
    retirement_id: retirementId,
  });

  if (!result) {
    throw notFound('retirement');
  }

  return c.json({ data: result });
});

export { retirements };
