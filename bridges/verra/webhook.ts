/**
 * Verra VCS Webhook Handler
 *
 * Receives inbound webhook events from the Verra VCS registry for credit
 * status updates (review completion, retirement notifications, cancellations).
 *
 * Webhook payloads are validated via HMAC-SHA256 signature before processing.
 * Events are translated into bridge state transitions and published to
 * sc.bridges.verra.status for downstream consumption.
 */

import { type BridgeMappingStore, type BridgeState } from './mapping';
import { type VerraClient } from './client';

// ---------------------------------------------------------------------------
// Webhook Event Types (Verra → SynergyCarbon)
// ---------------------------------------------------------------------------

export type VerraWebhookEventType =
  | 'credit.review_complete'
  | 'credit.registered'
  | 'credit.retired'
  | 'credit.cancelled'
  | 'credit.status_changed';

export interface VerraWebhookEvent {
  event_id: string;
  event_type: VerraWebhookEventType;
  timestamp: string;
  vcu_serial: string;
  project_id: string;
  data: VerraWebhookData;
}

export interface VerraWebhookData {
  status?: string;
  review_result?: 'approved' | 'rejected';
  rejection_reason?: string;
  retired_by?: string;
  retirement_reason?: string;
  retirement_date?: string;
  cancellation_reason?: string;
  sc_reference?: string;
}

// ---------------------------------------------------------------------------
// Bridge Status Event (SynergyCarbon internal)
// ---------------------------------------------------------------------------

export interface BridgeStatusEvent {
  credit_id: string;
  verra_serial: string;
  previous_state: BridgeState;
  new_state: BridgeState;
  event_type: VerraWebhookEventType;
  timestamp: number;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Webhook Handler
// ---------------------------------------------------------------------------

export interface WebhookHandlerConfig {
  signing_secret: string;
  timestamp_tolerance_ms: number;
}

const DEFAULT_HANDLER_CONFIG: Partial<WebhookHandlerConfig> = {
  timestamp_tolerance_ms: 300_000, // 5 minutes
};

export class VerraWebhookHandler {
  private readonly config: WebhookHandlerConfig;
  private readonly store: BridgeMappingStore;
  private readonly client: VerraClient;
  private readonly event_listeners: Array<(event: BridgeStatusEvent) => void> = [];

  constructor(
    config: Partial<WebhookHandlerConfig> & Pick<WebhookHandlerConfig, 'signing_secret'>,
    store: BridgeMappingStore,
    client: VerraClient,
  ) {
    this.config = { ...DEFAULT_HANDLER_CONFIG, ...config } as WebhookHandlerConfig;
    this.store = store;
    this.client = client;
  }

  on_bridge_status(listener: (event: BridgeStatusEvent) => void): void {
    this.event_listeners.push(listener);
  }

  // ── Request Validation ────────────────────────────────────────────────

  async validate_request(
    raw_body: string,
    signature_header: string,
    timestamp_header: string,
  ): Promise<boolean> {
    const timestamp = parseInt(timestamp_header, 10);
    if (isNaN(timestamp)) return false;

    const age = Math.abs(Date.now() - timestamp);
    if (age > this.config.timestamp_tolerance_ms) return false;

    const expected = await compute_hmac(
      this.config.signing_secret,
      `${timestamp}.${raw_body}`,
    );

    return timing_safe_equal(expected, signature_header);
  }

  // ── Event Processing ──────────────────────────────────────────────────

  async handle_event(event: VerraWebhookEvent): Promise<BridgeStatusEvent | null> {
    const record = this.store.get_by_verra_serial(event.vcu_serial);
    if (!record) {
      // Unknown VCU serial — may not be a SynergyCarbon-bridged credit
      return null;
    }

    const previous_state = record.state;
    let new_state: BridgeState;

    switch (event.event_type) {
      case 'credit.review_complete':
        if (event.data.review_result === 'approved') {
          new_state = 'LISTED';
          this.store.transition(record.credit_id, 'LISTED', {
            verra_serial: event.vcu_serial,
            verra_project_id: event.project_id,
          });
        } else {
          new_state = 'REJECTED';
          this.store.transition(record.credit_id, 'REJECTED', {
            rejection_reason: event.data.rejection_reason,
          });
        }
        break;

      case 'credit.registered':
        new_state = 'LISTED';
        this.store.transition(record.credit_id, 'LISTED', {
          verra_serial: event.vcu_serial,
          verra_project_id: event.project_id,
        });
        break;

      case 'credit.retired':
        new_state = 'RETIRED';
        this.store.transition(record.credit_id, 'RETIRED');
        break;

      case 'credit.cancelled':
        new_state = 'REJECTED';
        this.store.transition(record.credit_id, 'REJECTED', {
          rejection_reason: event.data.cancellation_reason,
        });
        break;

      case 'credit.status_changed': {
        const target = map_verra_status_to_bridge_state(event.data.status);
        if (!target || target === previous_state) return null;
        new_state = target;
        this.store.transition(record.credit_id, target);
        break;
      }

      default:
        return null;
    }

    const bridge_event: BridgeStatusEvent = {
      credit_id: record.credit_id,
      verra_serial: event.vcu_serial,
      previous_state,
      new_state,
      event_type: event.event_type,
      timestamp: Date.now(),
      details: event.data as unknown as Record<string, unknown>,
    };

    for (const listener of this.event_listeners) {
      listener(bridge_event);
    }

    return bridge_event;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function map_verra_status_to_bridge_state(status?: string): BridgeState | null {
  switch (status) {
    case 'registered':
    case 'active':
      return 'LISTED';
    case 'retired':
      return 'RETIRED';
    case 'cancelled':
    case 'rejected':
      return 'REJECTED';
    default:
      return null;
  }
}

async function compute_hmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timing_safe_equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
