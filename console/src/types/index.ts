/**
 * SynergyCarbon shared TypeScript types.
 *
 * These mirror the ESCIR circuit type definitions for use in Console Kit
 * widgets. The canonical source of truth is the circuit YAML files;
 * these TS types are the browser-side representation.
 */

// ---------------------------------------------------------------------------
// Carbon Credit (ECC-1 NFT)
// ---------------------------------------------------------------------------

export interface CarbonCredit {
  credit_id: Uint8Array;       // bytes(32)
  serial_number: string;       // SC-YYYY-NNNNNN
  tenant_id: string;
  attestation_id: Uint8Array;
  methodology_id: string;
  vintage_year: number;
  tonnes_co2e: number;
  source_type: SourceType;
  project_name: string;
  project_location: string;
  status: CreditStatus;
  issued_at: number;           // epoch ms
  retired_at?: number;
  retired_by?: Uint8Array;
  evidence_hash: Uint8Array;
}

export type CreditStatus =
  | 'Issued'
  | 'Listed'
  | 'Sold'
  | 'Retired'
  | 'Cancelled';

export type SourceType =
  | 'thermoelectric'
  | 'solar'
  | 'wind'
  | 'biogas'
  | 'ccs'
  | 'geothermal'
  | 'hydro'
  | 'nature_based';

// ---------------------------------------------------------------------------
// Verified Attestation
// ---------------------------------------------------------------------------

export interface Attestation {
  attestation_id: Uint8Array;
  tenant_id: string;
  epoch_id: number;
  site_id: Uint8Array;
  merkle_root: Uint8Array;
  total_energy_wh: number;
  methodology_id: string;
  tonnes_co2e: number;
  quorum_count: number;
  confidence: number;
  evidence_hash: Uint8Array;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

export interface Retirement {
  retirement_id: Uint8Array;
  credit_id: Uint8Array;
  retired_by: Uint8Array;
  tonnes_co2e: number;
  beneficiary_name: string;
  retirement_reason: string;
  certificate_hash: Uint8Array;
  retired_at: number;
  trigger_type: RetirementTriggerType;
}

export type RetirementTriggerType =
  | 'circuit_invocation'
  | 'api_call'
  | 'stream_event'
  | 'schedule'
  | 'threshold';

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export interface MarketplaceListing {
  listing_id: Uint8Array;
  credit_id: Uint8Array;
  seller: Uint8Array;
  price_usd: number;
  tonnes_co2e: number;
  vintage_year: number;
  methodology_id: string;
  source_type: SourceType;
  listed_at: number;
  status: ListingStatus;
}

export type ListingStatus =
  | 'Active'
  | 'Filled'
  | 'Cancelled'
  | 'Expired';

// ---------------------------------------------------------------------------
// Forward Contract
// ---------------------------------------------------------------------------

export interface ForwardContract {
  contract_id: Uint8Array;
  buyer: Uint8Array;
  seller: Uint8Array;
  methodology_id: string;
  source_type: SourceType;
  total_tonnes: number;
  delivered_tonnes: number;
  price_per_tonne_usd: number;
  start_epoch: number;
  end_epoch: number;
  delivery_schedule: string;
  status: ContractStatus;
  created_at: number;
}

export type ContractStatus =
  | 'Proposed'
  | 'Active'
  | 'Delivering'
  | 'Settled'
  | 'Defaulted'
  | 'Terminated';

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

export interface Methodology {
  methodology_id: Uint8Array;
  name: string;
  version: string;
  source_types: SourceType[];
  emission_factor_model: string;
  baseline_algorithm: string;
  registry_compatibility: string[];
  status: 'approved' | 'test' | 'deprecated';
  approved_at: number;
}

export interface GovernanceProposal {
  proposal_id: Uint8Array;
  proposal_type: ProposalType;
  title: string;
  description: string;
  proposer: Uint8Array;
  votes_for: number;
  votes_against: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: number;
  expires_at: number;
}

export type ProposalType =
  | 'methodology_approval'
  | 'verifier_registration'
  | 'parameter_change'
  | 'verifier_revocation';

// ---------------------------------------------------------------------------
// Impact (Widget data)
// ---------------------------------------------------------------------------

export interface EntityImpact {
  entity_id: Uint8Array;
  entity_name: string;
  total_tco2e_retired: number;
  total_credits_retired: number;
  total_tco2e_this_year: number;
  total_tco2e_this_month: number;
  first_retirement_at: number;
  last_retirement_at: number;
}

// ---------------------------------------------------------------------------
// AI Forecasting
// ---------------------------------------------------------------------------

export interface YieldForecast {
  tenant_id: string;
  project_id: string;
  horizon: string;
  point_estimate: number;
  confidence_lower: number;
  confidence_upper: number;
  model_version: string;
  generated_at: number;
}

export interface ForwardPricePoint {
  tenor_months: number;
  price_usd: number;
  confidence_interval: number;
}

export interface ForwardCurve {
  spot_price_usd: number;
  curve: ForwardPricePoint[];
  generated_at: number;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEvent {
  event_id: Uint8Array;
  action: string;
  subject: Uint8Array;
  actor: Uint8Array;
  timestamp: number;
  details: string;
  prev_event_hash: Uint8Array;
}

// ---------------------------------------------------------------------------
// Lex Topic Constants
// ---------------------------------------------------------------------------

export const LEX_TOPICS = {
  // Core
  ATTESTATIONS_VERIFIED: 'lex://sc/attestations/verified',
  ATTESTATIONS_REJECTED: 'lex://sc/attestations/rejected',
  CREDITS_ISSUED: 'lex://sc/credits/issued',
  CREDITS_TRANSFERRED: 'lex://sc/credits/transferred',
  CREDITS_RETIRED: 'lex://sc/credits/retired',
  CREDITS_CANCELLED: 'lex://sc/credits/cancelled',

  // Marketplace
  MARKETPLACE_LISTED: 'lex://sc/marketplace/listed',
  MARKETPLACE_SETTLED: 'lex://sc/marketplace/settled',
  MARKETPLACE_CANCELLED: 'lex://sc/marketplace/cancelled',

  // Forward Contracts
  CONTRACTS_PROPOSED: 'lex://sc/contracts/proposed',
  CONTRACTS_ACCEPTED: 'lex://sc/contracts/accepted',
  CONTRACTS_DELIVERY: 'lex://sc/contracts/delivery',
  CONTRACTS_SETTLED: 'lex://sc/contracts/settled',

  // Retirement
  RETIREMENTS_TRIGGERED: 'lex://sc/retirements/triggered',
  RETIREMENTS_CONFIRMED: 'lex://sc/retirements/confirmed',
  RETIREMENTS_CERTIFICATE: 'lex://sc/retirements/certificate',

  // Governance
  GOVERNANCE_PROPOSALS: 'lex://sc/governance/proposals/result',
  GOVERNANCE_METHODOLOGY: 'lex://sc/governance/methodology/approved',
  GOVERNANCE_VERIFIER: 'lex://sc/governance/verifier/registered',
  GOVERNANCE_PARAMETERS: 'lex://sc/governance/parameters/updated',

  // Impact
  IMPACT_UPDATES: 'lex://sc/impact/updates',

  // Audit
  AUDIT_EVENTS: 'lex://sc/audit/events',

  // AI
  AI_FORECAST: 'lex://sc/ai/forecast',
  AI_FORWARD_CURVE: 'lex://sc/ai/forward_curve',
} as const;
