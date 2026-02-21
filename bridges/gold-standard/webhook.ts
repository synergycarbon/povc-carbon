/**
 * Gold Standard Webhook Receiver
 *
 * Inbound endpoint for Gold Standard push notifications. Verifies webhook
 * signatures (HMAC-SHA256), parses event payloads, and dispatches to the
 * bridge circuit for credit status mirroring.
 */

import { BridgeState, BridgeStateFromGSStatus, MirrorMapping } from "./mapping";

export enum GSWebhookEventType {
  CREDIT_ISSUED = "credit.issued",
  CREDIT_RETIRED = "credit.retired",
  CREDIT_TRANSFERRED = "credit.transferred",
  CREDIT_STATUS_UPDATED = "credit.status_updated",
  REVIEW_COMPLETED = "review.completed",
  REVIEW_REJECTED = "review.rejected",
}

export interface GSWebhookEvent {
  eventId: string;
  eventType: GSWebhookEventType;
  timestamp: number;
  data: {
    gsSerial: string;
    projectId: string;
    vintageYear: number;
    tonnesCo2e: number;
    methodologyId: string;
    status: string;
    previousStatus?: string;
    beneficiaryName?: string;
    retirementReason?: string;
  };
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId: string;
  error?: string;
}

export interface WebhookHandlerResult {
  eventId: string;
  processed: boolean;
  newState?: BridgeState;
  creditId?: string;
  error?: string;
}

type MappingStore = {
  getByGsSerial(gsSerial: string): Promise<MirrorMapping | null>;
  updateState(creditId: string, state: BridgeState): Promise<void>;
};

export class GoldStandardWebhookReceiver {
  private webhookSecret: Uint8Array;
  private store: MappingStore;

  constructor(webhookSecret: Uint8Array, store: MappingStore) {
    this.webhookSecret = webhookSecret;
    this.store = store;
  }

  async verifySignature(
    rawBody: Uint8Array,
    signatureHeader: string,
    timestampHeader: string
  ): Promise<WebhookVerificationResult> {
    const timestamp = parseInt(timestampHeader, 10);
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    if (isNaN(timestamp) || Math.abs(now - timestamp) > FIVE_MINUTES_MS) {
      return {
        valid: false,
        eventId: "",
        error: "Timestamp outside acceptable window",
      };
    }

    const key = await crypto.subtle.importKey(
      "raw",
      this.webhookSecret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedPayload = new TextEncoder().encode(
      `${timestampHeader}.${new TextDecoder().decode(rawBody)}`
    );

    const signatureBytes = hexToBytes(signatureHeader);
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, signedPayload);

    if (!valid) {
      return { valid: false, eventId: "", error: "Invalid HMAC signature" };
    }

    let event: GSWebhookEvent;
    try {
      event = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return { valid: false, eventId: "", error: "Malformed JSON payload" };
    }

    return { valid: true, eventId: event.eventId };
  }

  async handleEvent(event: GSWebhookEvent): Promise<WebhookHandlerResult> {
    const mapping = await this.store.getByGsSerial(event.data.gsSerial);

    switch (event.eventType) {
      case GSWebhookEventType.CREDIT_ISSUED:
        return this.handleCreditIssued(event, mapping);

      case GSWebhookEventType.REVIEW_COMPLETED:
        return this.handleReviewCompleted(event, mapping);

      case GSWebhookEventType.REVIEW_REJECTED:
        return this.handleReviewRejected(event, mapping);

      case GSWebhookEventType.CREDIT_RETIRED:
        return this.handleCreditRetired(event, mapping);

      case GSWebhookEventType.CREDIT_STATUS_UPDATED:
        return this.handleStatusUpdated(event, mapping);

      case GSWebhookEventType.CREDIT_TRANSFERRED:
        return this.handleCreditTransferred(event, mapping);

      default:
        return {
          eventId: event.eventId,
          processed: false,
          error: `Unknown event type: ${event.eventType}`,
        };
    }
  }

  private async handleCreditIssued(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    const newState = BridgeState.MIRRORED;
    await this.store.updateState(mapping.creditId, newState);

    return {
      eventId: event.eventId,
      processed: true,
      newState,
      creditId: mapping.creditId,
    };
  }

  private async handleReviewCompleted(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    const newState = BridgeState.SYNCED;
    await this.store.updateState(mapping.creditId, newState);

    return {
      eventId: event.eventId,
      processed: true,
      newState,
      creditId: mapping.creditId,
    };
  }

  private async handleReviewRejected(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    const newState = BridgeState.REJECTED;
    await this.store.updateState(mapping.creditId, newState);

    return {
      eventId: event.eventId,
      processed: true,
      newState,
      creditId: mapping.creditId,
    };
  }

  private async handleCreditRetired(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    await this.store.updateState(mapping.creditId, BridgeState.SYNCED);

    return {
      eventId: event.eventId,
      processed: true,
      newState: BridgeState.SYNCED,
      creditId: mapping.creditId,
    };
  }

  private async handleStatusUpdated(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    const newState = BridgeStateFromGSStatus(event.data.status);
    await this.store.updateState(mapping.creditId, newState);

    return {
      eventId: event.eventId,
      processed: true,
      newState,
      creditId: mapping.creditId,
    };
  }

  private async handleCreditTransferred(
    event: GSWebhookEvent,
    mapping: MirrorMapping | null
  ): Promise<WebhookHandlerResult> {
    if (!mapping) {
      return {
        eventId: event.eventId,
        processed: false,
        error: `No mapping found for GS serial ${event.data.gsSerial}`,
      };
    }

    return {
      eventId: event.eventId,
      processed: true,
      newState: mapping.state,
      creditId: mapping.creditId,
    };
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
