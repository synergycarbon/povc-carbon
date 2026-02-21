import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { notFound } from '../lib/errors.js';

const contracts = new Hono();
const wire = new WireClient();

// GET /api/v1/contracts — List forward contracts
contracts.get('/', requireScope('contracts:read'), async (c) => {
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);
  const sparkIdentity = c.get('sparkIdentity');

  const filters: Record<string, unknown> = {};
  if (query.status) filters.status = query.status;
  if (query.contract_type) filters.contract_type = query.contract_type;
  if (query.project_id) filters.project_id = query.project_id;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.marketplace.forward_contracts.v1', 'list', {
    filters,
    cursor: cursorData,
    limit: limit + 1,
    caller: sparkIdentity,
  });

  const items = (result as { contracts: Record<string, unknown>[] }).contracts;
  const response = buildPaginatedResponse(items, limit, 'contract_id');

  return c.json(response);
});

// GET /api/v1/contracts/:contract_id — Get contract details + settlement history
contracts.get('/:contract_id', requireScope('contracts:read'), async (c) => {
  const contractId = c.req.param('contract_id');
  const sparkIdentity = c.get('sparkIdentity');

  const result = await wire.invoke('sc.marketplace.forward_contracts.v1', 'get_detail', {
    contract_id: contractId,
    caller: sparkIdentity,
  });

  if (!result) {
    throw notFound('contract');
  }

  return c.json({ data: result });
});

export { contracts };
