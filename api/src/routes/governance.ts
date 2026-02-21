import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope } from '../auth/middleware.js';

const governance = new Hono();
const wire = new WireClient();

// GET /api/v1/governance/methodologies — List approved methodologies
governance.get('/methodologies', requireScope('governance:read'), async (c) => {
  const query = c.req.query();

  const filters: Record<string, unknown> = {};
  if (query.status) filters.status = query.status;
  if (query.source_type) filters.source_type = query.source_type;

  const result = await wire.invoke('sc.governance.v1', 'list_methodologies', {
    filters,
  });

  const items = (result as { methodologies: Record<string, unknown>[] }).methodologies;
  return c.json({ data: items });
});

export { governance };
