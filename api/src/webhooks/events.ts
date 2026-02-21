export const WEBHOOK_EVENT_TYPES = [
  'credit.issued',
  'credit.retired',
  'credit.transferred',
  'attestation.verified',
  'marketplace.order.filled',
  'contract.settled',
  'trigger.fired',
  'bridge.status_changed',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEventBase {
  event_id: string;
  event_type: WebhookEventType;
  timestamp: string;
}

export interface CreditIssuedPayload extends WebhookEventBase {
  event_type: 'credit.issued';
  credit_id: string;
  serial_number: string;
  project_id: string;
  vintage_year: number;
  credit_type: 'avoidance' | 'removal' | 'sequestration';
  methodology: string;
  tonnes_co2e: number;
  attestation_id: string;
  merkle_root?: string;
  owner: string;
}

export interface CreditRetiredPayload extends WebhookEventBase {
  event_type: 'credit.retired';
  credit_id: string;
  serial_number: string;
  retirement_id: string;
  certificate_id: string;
  tonnes_co2e: number;
  vintage_year?: number;
  project_id?: string;
  methodology?: string;
  retired_by: string;
  retirement_reason: string;
  beneficiary_name?: string;
  certificate_url?: string;
  verify_url?: string;
}

export interface CreditTransferredPayload extends WebhookEventBase {
  event_type: 'credit.transferred';
  credit_id: string;
  serial_number: string;
  tonnes_co2e?: number;
  from_owner: string;
  to_owner: string;
  transfer_type: 'direct' | 'marketplace_settlement' | 'contract_settlement';
  order_id?: string;
  contract_id?: string;
}

export interface AttestationVerifiedPayload extends WebhookEventBase {
  event_type: 'attestation.verified';
  attestation_id: string;
  project_id: string;
  tenant_id?: string;
  epoch_id: string;
  methodology: string;
  total_energy_wh: number;
  tonnes_co2e: number;
  quorum_count: number;
  quorum_required: number;
  confidence: number;
  merkle_root: string;
}

export interface MarketplaceOrderFilledPayload extends WebhookEventBase {
  event_type: 'marketplace.order.filled';
  order_id: string;
  listing_id: string;
  credit_id: string;
  serial_number: string;
  tonnes_co2e: number;
  price_per_tonne: number;
  total_price: number;
  buyer: string;
  seller: string;
  settled_at: string;
}

export interface ContractSettledPayload extends WebhookEventBase {
  event_type: 'contract.settled';
  contract_id: string;
  settlement_id: string;
  credit_id: string;
  serial_number?: string;
  tonnes_co2e: number;
  price_per_tonne?: number;
  total_settled: number;
  total_contracted: number;
  delivery_percentage: number;
  buyer: string;
  seller: string;
  contract_status: 'active' | 'delivering' | 'completed';
}

export interface TriggerFiredPayload extends WebhookEventBase {
  event_type: 'trigger.fired';
  trigger_id: string;
  trigger_type: string;
  credit_id: string;
  serial_number: string;
  tonnes_co2e: number;
  condition: Record<string, unknown>;
  action_taken: string;
  retirement_id?: string;
}

export interface BridgeStatusChangedPayload extends WebhookEventBase {
  event_type: 'bridge.status_changed';
  bridge_id: string;
  registry: string;
  previous_status: string;
  new_status: string;
  credit_id?: string;
  serial_number?: string;
  external_serial?: string;
  message?: string;
}

export type WebhookPayload =
  | CreditIssuedPayload
  | CreditRetiredPayload
  | CreditTransferredPayload
  | AttestationVerifiedPayload
  | MarketplaceOrderFilledPayload
  | ContractSettledPayload
  | TriggerFiredPayload
  | BridgeStatusChangedPayload;

export function isValidEventType(type: string): type is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(type);
}
