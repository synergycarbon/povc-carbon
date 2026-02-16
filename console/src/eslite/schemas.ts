/**
 * ESLite table schemas for SynergyCarbon Console Kit.
 *
 * ESLite is the WASM-backed local-first storage used by Console Kit widgets
 * for offline caching and fast queries. These schemas define the tables
 * that widgets can read from via `useEsliteQuery()`.
 *
 * Data flows: Lex topic → WASM Data Gateway → ESLite table → Widget
 */

export interface EsliteTableSchema {
  name: string;
  description: string;
  primary_key: string;
  indexes: string[];
  lex_source: string;
  retention_days: number;
}

export const ESLITE_SCHEMAS: EsliteTableSchema[] = [
  {
    name: 'carbon_credits',
    description: 'Carbon credit NFTs with current status',
    primary_key: 'credit_id',
    indexes: ['tenant_id', 'status', 'vintage_year', 'methodology_id', 'source_type'],
    lex_source: 'lex://sc/credits/*',
    retention_days: 3650,
  },
  {
    name: 'attestations',
    description: 'Verified attestation records from PoVCR verifier',
    primary_key: 'attestation_id',
    indexes: ['tenant_id', 'epoch_id', 'site_id', 'methodology_id'],
    lex_source: 'lex://sc/attestations/verified',
    retention_days: 3650,
  },
  {
    name: 'retirements',
    description: 'Credit retirement records with certificates',
    primary_key: 'retirement_id',
    indexes: ['credit_id', 'retired_by', 'retired_at', 'trigger_type'],
    lex_source: 'lex://sc/retirements/*',
    retention_days: 3650,
  },
  {
    name: 'marketplace_listings',
    description: 'Active and historical marketplace listings',
    primary_key: 'listing_id',
    indexes: ['credit_id', 'seller', 'status', 'vintage_year', 'price_usd'],
    lex_source: 'lex://sc/marketplace/*',
    retention_days: 365,
  },
  {
    name: 'forward_contracts',
    description: 'Forward contract state and delivery progress',
    primary_key: 'contract_id',
    indexes: ['buyer', 'seller', 'status', 'methodology_id'],
    lex_source: 'lex://sc/contracts/*',
    retention_days: 1825,
  },
  {
    name: 'entity_impacts',
    description: 'Aggregated impact data per entity (for impact widgets)',
    primary_key: 'entity_id',
    indexes: ['total_tco2e_retired', 'last_retirement_at'],
    lex_source: 'lex://sc/impact/updates',
    retention_days: 3650,
  },
  {
    name: 'governance_proposals',
    description: 'Active and historical governance proposals',
    primary_key: 'proposal_id',
    indexes: ['proposal_type', 'status', 'created_at'],
    lex_source: 'lex://sc/governance/proposals/*',
    retention_days: 3650,
  },
  {
    name: 'approved_methodologies',
    description: 'Governance-approved carbon calculation methodologies',
    primary_key: 'methodology_id',
    indexes: ['status', 'source_types'],
    lex_source: 'lex://sc/governance/methodology/approved',
    retention_days: 3650,
  },
  {
    name: 'yield_forecasts',
    description: 'AI yield forecast snapshots',
    primary_key: 'tenant_id+project_id+generated_at',
    indexes: ['tenant_id', 'project_id', 'horizon'],
    lex_source: 'lex://sc/ai/forecast',
    retention_days: 365,
  },
  {
    name: 'forward_curves',
    description: 'AI forward pricing curve snapshots',
    primary_key: 'generated_at',
    indexes: ['spot_price_usd'],
    lex_source: 'lex://sc/ai/forward_curve',
    retention_days: 365,
  },
  {
    name: 'audit_events',
    description: 'Audit trail events (hash-chained)',
    primary_key: 'event_id',
    indexes: ['action', 'actor', 'timestamp', 'subject'],
    lex_source: 'lex://sc/audit/events',
    retention_days: 3650,
  },
];
