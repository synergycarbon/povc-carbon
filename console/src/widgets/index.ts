/**
 * SynergyCarbon Widget Catalog — Registration Barrel
 *
 * All Console Kit widgets are registered here, organized by RBAC visibility tier.
 * The catalog is passed to WidgetGrid for layout and WidgetPicker for discovery.
 *
 * Visibility tiers (cumulative access):
 *   public  → no auth required, embeddable
 *   buyer   → authenticated buyers
 *   auditor → compliance and governance reviewers
 *   owner   → full platform access
 */

import type { WidgetManifest } from '@estream/sdk-browser/widgets';

// Public tier — embeddable, no auth
import { IMPACT_COUNTER_MANIFEST } from './impact-counter/manifest';
import { IMPACT_LEADERBOARD_MANIFEST } from './impact-leaderboard/manifest';
import { IMPACT_LIVE_METER_MANIFEST } from './impact-live-meter/manifest';

// Buyer tier
import { MARKETPLACE_MANIFEST } from './marketplace/manifest';
import { FORWARD_CONTRACTS_MANIFEST } from './forward-contracts/manifest';
import { RETIREMENT_ENGINE_MANIFEST } from './retirement-engine/manifest';
import { IMPACT_CERTIFICATE_MANIFEST } from './impact-certificate/manifest';

// Auditor tier
import { AUDIT_TRAIL_MANIFEST } from './audit-trail/manifest';
import { ATTESTATION_MONITOR_MANIFEST } from './attestation-monitor/manifest';
import { GOVERNANCE_MANIFEST } from './governance/manifest';

// Owner tier — full access
import { CREDIT_REGISTRY_MANIFEST } from './credit-registry/manifest';
import { YIELD_FORECAST_MANIFEST } from './yield-forecast/manifest';
import { RISK_MONITOR_MANIFEST } from './risk-monitor/manifest';
import { PRICING_ORACLE_MANIFEST } from './pricing-oracle/manifest';

export const WIDGET_CATALOG: WidgetManifest[] = [
  // Public
  IMPACT_COUNTER_MANIFEST,
  IMPACT_LEADERBOARD_MANIFEST,
  IMPACT_LIVE_METER_MANIFEST,

  // Buyer
  MARKETPLACE_MANIFEST,
  FORWARD_CONTRACTS_MANIFEST,
  RETIREMENT_ENGINE_MANIFEST,
  IMPACT_CERTIFICATE_MANIFEST,

  // Auditor
  AUDIT_TRAIL_MANIFEST,
  ATTESTATION_MONITOR_MANIFEST,
  GOVERNANCE_MANIFEST,

  // Owner
  CREDIT_REGISTRY_MANIFEST,
  YIELD_FORECAST_MANIFEST,
  RISK_MONITOR_MANIFEST,
  PRICING_ORACLE_MANIFEST,
];

export {
  IMPACT_COUNTER_MANIFEST,
  IMPACT_LEADERBOARD_MANIFEST,
  IMPACT_LIVE_METER_MANIFEST,
  MARKETPLACE_MANIFEST,
  FORWARD_CONTRACTS_MANIFEST,
  RETIREMENT_ENGINE_MANIFEST,
  IMPACT_CERTIFICATE_MANIFEST,
  AUDIT_TRAIL_MANIFEST,
  ATTESTATION_MONITOR_MANIFEST,
  GOVERNANCE_MANIFEST,
  CREDIT_REGISTRY_MANIFEST,
  YIELD_FORECAST_MANIFEST,
  RISK_MONITOR_MANIFEST,
  PRICING_ORACLE_MANIFEST,
};
