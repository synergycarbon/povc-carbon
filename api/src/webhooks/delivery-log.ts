import { v4 as uuid } from 'uuid';

export interface DeliveryAttempt {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  attempt: number;
  status: 'success' | 'failed' | 'pending';
  http_status?: number;
  response_body?: string;
  latency_ms?: number;
  error?: string;
  attempted_at: string;
  next_retry_at?: string;
}

export interface DeliveryRecord {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  payload: string;
  status: 'delivered' | 'failed' | 'retrying';
  attempts: DeliveryAttempt[];
  created_at: string;
  delivered_at?: string;
}

const deliveries = new Map<string, DeliveryRecord>();
const byWebhook = new Map<string, Set<string>>();

export function createDeliveryRecord(
  webhookId: string,
  eventId: string,
  eventType: string,
  payload: string,
): DeliveryRecord {
  const record: DeliveryRecord = {
    id: uuid(),
    webhook_id: webhookId,
    event_id: eventId,
    event_type: eventType,
    payload,
    status: 'retrying',
    attempts: [],
    created_at: new Date().toISOString(),
  };

  deliveries.set(record.id, record);

  let webhookDeliveries = byWebhook.get(webhookId);
  if (!webhookDeliveries) {
    webhookDeliveries = new Set();
    byWebhook.set(webhookId, webhookDeliveries);
  }
  webhookDeliveries.add(record.id);

  return record;
}

export function addAttempt(
  deliveryId: string,
  attempt: Omit<DeliveryAttempt, 'id' | 'webhook_id' | 'event_id' | 'event_type'>,
): DeliveryAttempt | null {
  const record = deliveries.get(deliveryId);
  if (!record) return null;

  const entry: DeliveryAttempt = {
    id: uuid(),
    webhook_id: record.webhook_id,
    event_id: record.event_id,
    event_type: record.event_type,
    ...attempt,
  };

  record.attempts.push(entry);

  if (entry.status === 'success') {
    record.status = 'delivered';
    record.delivered_at = entry.attempted_at;
  } else if (entry.attempt >= 5) {
    record.status = 'failed';
  }

  return entry;
}

export function getDeliveryRecord(deliveryId: string): DeliveryRecord | undefined {
  return deliveries.get(deliveryId);
}

export function listDeliveriesForWebhook(
  webhookId: string,
  cursor?: string | null,
  limit = 25,
): { items: DeliveryRecord[]; total: number } {
  const ids = byWebhook.get(webhookId);
  if (!ids) return { items: [], total: 0 };

  const all = Array.from(ids)
    .map((id) => deliveries.get(id)!)
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = all.length;

  let startIdx = 0;
  if (cursor) {
    const idx = all.findIndex((d) => d.id === cursor);
    if (idx >= 0) startIdx = idx + 1;
  }

  return { items: all.slice(startIdx, startIdx + limit + 1), total };
}

export function clearDeliveriesForWebhook(webhookId: string): void {
  const ids = byWebhook.get(webhookId);
  if (!ids) return;
  for (const id of ids) {
    deliveries.delete(id);
  }
  byWebhook.delete(webhookId);
}
