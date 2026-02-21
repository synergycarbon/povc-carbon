import { Hono } from 'hono';
import { requireScope } from '../auth/middleware.js';
import { parsePaginationParams, buildPaginatedResponse } from '../lib/pagination.js';
import { badRequest, notFound } from '../lib/errors.js';
import { registerWebhook, listWebhooks, getWebhook, deleteWebhook } from '../webhooks/registry.js';
import { listDeliveriesForWebhook } from '../webhooks/delivery-log.js';
import { WEBHOOK_EVENT_TYPES, isValidEventType } from '../webhooks/events.js';

const webhooks = new Hono();

// POST /api/v1/webhooks — Register a webhook endpoint
webhooks.post('/', requireScope('webhooks:write'), async (c) => {
  const owner = c.get('sparkIdentity');
  const body = await c.req.json<{
    url?: string;
    events?: string[];
  }>();

  if (!body.url || typeof body.url !== 'string') {
    throw badRequest('url is required and must be a string');
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    throw badRequest('events is required and must be a non-empty array', {
      valid_events: [...WEBHOOK_EVENT_TYPES],
    });
  }

  const invalidEvents = body.events.filter((e) => !isValidEventType(e));
  if (invalidEvents.length > 0) {
    throw badRequest(`Invalid event types: ${invalidEvents.join(', ')}`, {
      invalid: invalidEvents,
      valid_events: [...WEBHOOK_EVENT_TYPES],
    });
  }

  try {
    const registration = registerWebhook(body.url, body.events, owner);

    return c.json({
      data: {
        id: registration.id,
        url: registration.url,
        events: registration.events,
        secret: registration.secret,
        active: registration.active,
        created_at: registration.created_at,
      },
    }, 201);
  } catch (err) {
    throw badRequest((err as Error).message);
  }
});

// GET /api/v1/webhooks — List registered webhooks
webhooks.get('/', requireScope('webhooks:read'), async (c) => {
  const owner = c.get('sparkIdentity');
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const { items, total } = listWebhooks(owner, cursor, limit);
  const response = buildPaginatedResponse(
    items.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      created_at: w.created_at,
      updated_at: w.updated_at,
    })),
    limit,
    'id',
    null,
    total,
  );

  return c.json(response);
});

// DELETE /api/v1/webhooks/:id — Remove a webhook
webhooks.delete('/:id', requireScope('webhooks:write'), async (c) => {
  const owner = c.get('sparkIdentity');
  const id = c.req.param('id');

  const deleted = deleteWebhook(id, owner);
  if (!deleted) {
    throw notFound('webhook');
  }

  return c.json({ data: { id, deleted: true } });
});

// GET /api/v1/webhooks/:id/deliveries — View delivery log
webhooks.get('/:id/deliveries', requireScope('webhooks:read'), async (c) => {
  const owner = c.get('sparkIdentity');
  const id = c.req.param('id');
  const query = c.req.query();
  const { cursor, limit } = parsePaginationParams(query);

  const webhook = getWebhook(id);
  if (!webhook || webhook.owner !== owner) {
    throw notFound('webhook');
  }

  const { items, total } = listDeliveriesForWebhook(id, cursor, limit);
  const response = buildPaginatedResponse(
    items.map((d) => ({
      id: d.id,
      event_id: d.event_id,
      event_type: d.event_type,
      status: d.status,
      attempts: d.attempts.length,
      last_attempt: d.attempts[d.attempts.length - 1] ?? null,
      created_at: d.created_at,
      delivered_at: d.delivered_at ?? null,
    })),
    limit,
    'id',
    null,
    total,
  );

  return c.json(response);
});

export { webhooks };
