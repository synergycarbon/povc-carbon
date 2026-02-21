import { v4 as uuid } from 'uuid';
import type { WebhookEventType } from './events.js';
import { isValidEventType } from './events.js';
import { clearDeliveriesForWebhook } from './delivery-log.js';

export interface WebhookRegistration {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  owner: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const webhooks = new Map<string, WebhookRegistration>();
const byOwner = new Map<string, Set<string>>();

export function registerWebhook(
  url: string,
  events: string[],
  owner: string,
): WebhookRegistration {
  const validEvents = events.filter(isValidEventType);
  if (validEvents.length === 0) {
    throw new Error('At least one valid event type is required');
  }

  try {
    new URL(url);
  } catch {
    throw new Error('Invalid webhook URL');
  }

  const secret = uuid();
  const now = new Date().toISOString();

  const registration: WebhookRegistration = {
    id: uuid(),
    url,
    events: validEvents,
    secret,
    owner,
    active: true,
    created_at: now,
    updated_at: now,
  };

  webhooks.set(registration.id, registration);

  let ownerWebhooks = byOwner.get(owner);
  if (!ownerWebhooks) {
    ownerWebhooks = new Set();
    byOwner.set(owner, ownerWebhooks);
  }
  ownerWebhooks.add(registration.id);

  return registration;
}

export function getWebhook(id: string): WebhookRegistration | undefined {
  return webhooks.get(id);
}

export function listWebhooks(
  owner: string,
  cursor?: string | null,
  limit = 25,
): { items: WebhookRegistration[]; total: number } {
  const ids = byOwner.get(owner);
  if (!ids) return { items: [], total: 0 };

  const all = Array.from(ids)
    .map((id) => webhooks.get(id)!)
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = all.length;

  let startIdx = 0;
  if (cursor) {
    const idx = all.findIndex((w) => w.id === cursor);
    if (idx >= 0) startIdx = idx + 1;
  }

  return { items: all.slice(startIdx, startIdx + limit + 1), total };
}

export function deleteWebhook(id: string, owner: string): boolean {
  const webhook = webhooks.get(id);
  if (!webhook || webhook.owner !== owner) return false;

  webhooks.delete(id);
  clearDeliveriesForWebhook(id);

  const ownerWebhooks = byOwner.get(owner);
  if (ownerWebhooks) {
    ownerWebhooks.delete(id);
    if (ownerWebhooks.size === 0) byOwner.delete(owner);
  }

  return true;
}

export function getSubscribersForEvent(eventType: WebhookEventType): WebhookRegistration[] {
  const subscribers: WebhookRegistration[] = [];
  for (const webhook of webhooks.values()) {
    if (webhook.active && webhook.events.includes(eventType)) {
      subscribers.push(webhook);
    }
  }
  return subscribers;
}
