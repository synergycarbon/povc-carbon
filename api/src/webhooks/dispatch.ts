import { v4 as uuid } from 'uuid';
import type { WebhookPayload, WebhookEventType } from './events.js';
import { getSubscribersForEvent, type WebhookRegistration } from './registry.js';
import { signPayload } from './signature.js';
import { createDeliveryRecord, addAttempt } from './delivery-log.js';

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 5_000;
const MAX_DELAY_MS = 3_600_000;
const TIMEOUT_MS = 10_000;

function computeBackoff(attempt: number): number {
  const delay = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
}

async function deliverToEndpoint(
  webhook: WebhookRegistration,
  payload: WebhookPayload,
  idempotencyKey: string,
): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();

  const deliveryRecord = createDeliveryRecord(
    webhook.id,
    payload.event_id,
    payload.event_type,
    body,
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now();

    try {
      const signature = await signPayload(body, timestamp);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SC-Signature': signature,
          'X-SC-Timestamp': timestamp,
          'X-SC-Idempotency-Key': idempotencyKey,
          'X-SC-Event-Type': payload.event_type,
          'X-SC-Webhook-Id': webhook.id,
          'User-Agent': 'SynergyCarbon-Webhooks/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - attemptStart;
      let responseBody: string | undefined;
      try {
        responseBody = await response.text();
      } catch {
        // ignore body read failures
      }

      if (response.ok) {
        addAttempt(deliveryRecord.id, {
          attempt,
          status: 'success',
          http_status: response.status,
          response_body: responseBody?.slice(0, 1024),
          latency_ms: latencyMs,
          attempted_at: new Date().toISOString(),
        });
        return;
      }

      const nextRetryAt = attempt < MAX_RETRIES
        ? new Date(Date.now() + computeBackoff(attempt)).toISOString()
        : undefined;

      addAttempt(deliveryRecord.id, {
        attempt,
        status: 'failed',
        http_status: response.status,
        response_body: responseBody?.slice(0, 1024),
        latency_ms: latencyMs,
        error: `HTTP ${response.status}`,
        attempted_at: new Date().toISOString(),
        next_retry_at: nextRetryAt,
      });
    } catch (err) {
      const latencyMs = Date.now() - attemptStart;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      const nextRetryAt = attempt < MAX_RETRIES
        ? new Date(Date.now() + computeBackoff(attempt)).toISOString()
        : undefined;

      addAttempt(deliveryRecord.id, {
        attempt,
        status: 'failed',
        latency_ms: latencyMs,
        error: errorMessage,
        attempted_at: new Date().toISOString(),
        next_retry_at: nextRetryAt,
      });
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, computeBackoff(attempt)));
    }
  }
}

export async function dispatchEvent(payload: WebhookPayload): Promise<void> {
  const subscribers = getSubscribersForEvent(payload.event_type);
  if (subscribers.length === 0) return;

  const idempotencyKey = uuid();

  // Fan out deliveries concurrently — fire-and-forget per subscriber.
  // Retries happen inside deliverToEndpoint so the main request isn't blocked.
  const deliveries = subscribers.map((webhook) =>
    deliverToEndpoint(webhook, payload, idempotencyKey).catch((err) => {
      console.error(`Webhook delivery failed for ${webhook.id}:`, err);
    }),
  );

  // Don't await — dispatching is async background work
  Promise.allSettled(deliveries).catch(() => {});
}

export async function dispatchEventSync(payload: WebhookPayload): Promise<void> {
  const subscribers = getSubscribersForEvent(payload.event_type);
  if (subscribers.length === 0) return;

  const idempotencyKey = uuid();

  await Promise.allSettled(
    subscribers.map((webhook) => deliverToEndpoint(webhook, payload, idempotencyKey)),
  );
}
