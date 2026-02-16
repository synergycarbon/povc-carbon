/**
 * Widget Data Gateway Configuration
 *
 * Defines per-widget lex topic and ESLite table scoping rules.
 * The WASM-backed gateway enforces these at runtime — widgets can only
 * subscribe to topics and query tables listed in their manifest.
 *
 * This configuration is consumed by WidgetDataGateway to set up the
 * RBAC enforcement layer between widgets and the eStream network.
 */

export interface GatewayWidgetScope {
  widget_id: string;
  lex_topics: string[];
  eslite_tables: string[];
  min_role: string;
  spark_actions: string[];
}

export const GATEWAY_WIDGET_SCOPES: GatewayWidgetScope[] = [
  // --- Impact Widgets ---
  {
    widget_id: 'sc-impact-counter',
    lex_topics: ['lex://sc/impact/updates'],
    eslite_tables: ['entity_impacts'],
    min_role: 'public',
    spark_actions: [],
  },
  {
    widget_id: 'sc-impact-certificate',
    lex_topics: ['lex://sc/retirements/certificate'],
    eslite_tables: ['retirements', 'carbon_credits'],
    min_role: 'buyer',
    spark_actions: [],
  },
  {
    widget_id: 'sc-impact-live-meter',
    lex_topics: ['lex://sc/attestations/verified', 'lex://sc/impact/updates'],
    eslite_tables: ['attestations', 'entity_impacts'],
    min_role: 'public',
    spark_actions: [],
  },
  {
    widget_id: 'sc-impact-leaderboard',
    lex_topics: ['lex://sc/impact/updates'],
    eslite_tables: ['entity_impacts'],
    min_role: 'public',
    spark_actions: [],
  },

  // --- Operations Widgets ---
  {
    widget_id: 'sc-credit-registry',
    lex_topics: ['lex://sc/credits/*'],
    eslite_tables: ['carbon_credits', 'attestations'],
    min_role: 'buyer',
    spark_actions: ['retire_credits'],
  },
  {
    widget_id: 'sc-attestation-monitor',
    lex_topics: ['lex://sc/attestations/*'],
    eslite_tables: ['attestations'],
    min_role: 'auditor',
    spark_actions: [],
  },
  {
    widget_id: 'sc-marketplace',
    lex_topics: ['lex://sc/marketplace/*', 'lex://sc/credits/*'],
    eslite_tables: ['marketplace_listings', 'carbon_credits'],
    min_role: 'buyer',
    spark_actions: ['place_order', 'cancel_listing'],
  },
  {
    widget_id: 'sc-retirement-engine',
    lex_topics: ['lex://sc/retirements/*', 'lex://sc/credits/*'],
    eslite_tables: ['retirements', 'carbon_credits'],
    min_role: 'owner',
    spark_actions: ['retire_credits', 'create_trigger'],
  },
  {
    widget_id: 'sc-audit-trail',
    lex_topics: ['lex://sc/audit/events'],
    eslite_tables: ['audit_events'],
    min_role: 'auditor',
    spark_actions: [],
  },
  {
    widget_id: 'sc-governance',
    lex_topics: ['lex://sc/governance/*'],
    eslite_tables: ['governance_proposals', 'approved_methodologies'],
    min_role: 'owner',
    spark_actions: ['governance_vote', 'propose_methodology', 'register_verifier'],
  },

  // --- Analytics Widgets ---
  {
    widget_id: 'sc-yield-forecast',
    lex_topics: ['lex://sc/ai/forecast'],
    eslite_tables: ['yield_forecasts'],
    min_role: 'buyer',
    spark_actions: [],
  },
  {
    widget_id: 'sc-forward-contracts',
    lex_topics: ['lex://sc/contracts/*'],
    eslite_tables: ['forward_contracts'],
    min_role: 'buyer',
    spark_actions: ['sign_contract'],
  },
  {
    widget_id: 'sc-risk-monitor',
    lex_topics: ['lex://sc/ai/forecast', 'lex://sc/ai/forward_curve'],
    eslite_tables: ['yield_forecasts', 'forward_curves'],
    min_role: 'buyer',
    spark_actions: [],
  },
  {
    widget_id: 'sc-pricing-oracle',
    lex_topics: ['lex://sc/ai/forward_curve'],
    eslite_tables: ['forward_curves'],
    min_role: 'buyer',
    spark_actions: [],
  },
];
