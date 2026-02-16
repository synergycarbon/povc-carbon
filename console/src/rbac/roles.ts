/**
 * SynergyCarbon RBAC Role Definitions
 *
 * Maps DESIGN.md Section 4.3 visibility tiers to Console Kit roles.
 * These roles are enforced by the WASM-backed WidgetDataGateway.
 *
 * Visibility Tiers (from DESIGN.md):
 *   public  → Anyone (no auth required)
 *   buyer   → Authenticated credit holders / marketplace participants
 *   auditor → Third-party auditors with time-limited access tokens
 *   owner   → Credit owner / governance key holder
 */

import type { RoleDefinition } from '@estream/sdk-browser/widgets';

export const ROLES: Record<string, RoleDefinition> = {
  public: {
    id: 'public',
    name: 'Public',
    description: 'Unauthenticated visitors — impact widgets, public metrics only',
    requires_auth: false,
    visibility_tier: 'public',
    allowed_fields: [
      'credit_id', 'serial_number', 'vintage_year', 'tonnes_co2e',
      'source_type', 'project_name', 'status', 'methodology_id',
    ],
    lex_topics: [
      'lex://sc/impact/updates',
      'lex://sc/marketplace/listed',
    ],
    eslite_tables: [
      'entity_impacts',
    ],
  },

  buyer: {
    id: 'buyer',
    name: 'Buyer',
    description: 'Authenticated marketplace participant — trading, portfolio, forecasts',
    requires_auth: true,
    visibility_tier: 'buyer',
    allowed_fields: [
      'credit_id', 'serial_number', 'vintage_year', 'tonnes_co2e',
      'source_type', 'project_name', 'project_location', 'status',
      'methodology_id', 'issued_at', 'evidence_hash',
      'listing_id', 'price_usd', 'seller',
      'contract_id', 'buyer', 'total_tonnes', 'delivered_tonnes',
    ],
    lex_topics: [
      'lex://sc/credits/*',
      'lex://sc/marketplace/*',
      'lex://sc/contracts/*',
      'lex://sc/retirements/*',
      'lex://sc/impact/updates',
      'lex://sc/ai/forecast',
      'lex://sc/ai/forward_curve',
    ],
    eslite_tables: [
      'carbon_credits', 'marketplace_listings', 'forward_contracts',
      'retirements', 'entity_impacts', 'yield_forecasts', 'forward_curves',
    ],
  },

  auditor: {
    id: 'auditor',
    name: 'Auditor',
    description: 'Third-party auditor — compliance data, audit trail, regulatory exports',
    requires_auth: true,
    visibility_tier: 'auditor',
    token_ttl_days: 90,
    allowed_fields: [
      'credit_id', 'serial_number', 'vintage_year', 'tonnes_co2e',
      'source_type', 'project_name', 'project_location', 'status',
      'methodology_id', 'issued_at', 'evidence_hash',
      'attestation_id', 'tenant_id', 'epoch_id', 'merkle_root',
      'total_energy_wh', 'quorum_count', 'confidence',
      'event_id', 'action', 'actor', 'timestamp', 'details',
      'prev_event_hash',
    ],
    lex_topics: [
      'lex://sc/credits/*',
      'lex://sc/attestations/*',
      'lex://sc/retirements/*',
      'lex://sc/audit/events',
      'lex://sc/governance/methodology/approved',
    ],
    eslite_tables: [
      'carbon_credits', 'attestations', 'retirements',
      'audit_events', 'approved_methodologies',
    ],
  },

  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Credit owner / governance key holder — full access + Spark actions',
    requires_auth: true,
    visibility_tier: 'owner',
    allowed_fields: ['*'],
    lex_topics: ['lex://sc/*'],
    eslite_tables: [
      'carbon_credits', 'attestations', 'retirements',
      'marketplace_listings', 'forward_contracts', 'entity_impacts',
      'governance_proposals', 'approved_methodologies',
      'yield_forecasts', 'forward_curves', 'audit_events',
    ],
    spark_actions: [
      'retire_credits',
      'governance_vote',
      'sign_contract',
      'cancel_listing',
      'propose_methodology',
      'register_verifier',
    ],
  },
} as const;

export type RoleName = keyof typeof ROLES;
