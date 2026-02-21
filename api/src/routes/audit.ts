import { Hono } from 'hono';
import { WireClient } from '@estream/sdk-wire';
import { requireScope, requireTier } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse, decodeCursor } from '../lib/pagination.js';
import { ApiError } from '../lib/errors.js';
import type { ExportFormat } from '../types.js';

const audit = new Hono();
const wire = new WireClient();

const VALID_EXPORT_FORMATS: ExportFormat[] = [
  'ghg_protocol_csv', 'ghg_protocol_xlsx', 'verra_vcs',
  'gold_standard', 'iscc_json', 'soc2',
];

// GET /api/v1/audit/events — List audit trail events (auditor role required)
audit.get('/events', requireScope('audit:read'), requireTier('auditor'), async (c) => {
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const filters: Record<string, unknown> = {};
  if (query.action) filters.action = query.action;
  if (query.actor) filters.actor = query.actor;
  if (query.subject) filters.subject = query.subject;
  if (query.after) filters.after = query.after;
  if (query.before) filters.before = query.before;

  const cursorData = cursor ? decodeCursor(cursor) : null;

  const result = await wire.invoke('sc.core.audit_trail.v1', 'list_events', {
    filters,
    cursor: cursorData,
    limit: limit + 1,
  });

  const items = (result as { events: Record<string, unknown>[] }).events;
  const response = buildPaginatedResponse(items, limit, 'event_id');

  return c.json(response);
});

// GET /api/v1/audit/export — Export audit data in regulatory format (auditor role required)
audit.get('/export', requireScope('audit:read'), requireTier('auditor'), async (c) => {
  const query = c.req.query();

  const validationErrors: Array<{ field: string; message: string; code: string }> = [];

  if (!query.format) {
    validationErrors.push({ field: 'format', message: 'Field is required', code: 'required' });
  } else if (!VALID_EXPORT_FORMATS.includes(query.format as ExportFormat)) {
    validationErrors.push({ field: 'format', message: `Must be one of: ${VALID_EXPORT_FORMATS.join(', ')}`, code: 'enum' });
  }
  if (!query.start_date) {
    validationErrors.push({ field: 'start_date', message: 'Field is required', code: 'required' });
  }
  if (!query.end_date) {
    validationErrors.push({ field: 'end_date', message: 'Field is required', code: 'required' });
  }

  if (validationErrors.length > 0) {
    throw Object.assign(
      new ApiError(422, 'validation_failed', 'Request parameters failed validation'),
      { validationErrors },
    );
  }

  const result = await wire.invoke('sc.core.audit_trail.v1', 'create_export', {
    format: query.format,
    start_date: query.start_date,
    end_date: query.end_date,
    project_id: query.project_id,
  });

  return c.json({ data: result });
});

export { audit };
