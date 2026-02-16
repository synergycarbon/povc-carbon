/**
 * SynergyCarbon Widget Catalog — Registration Barrel
 *
 * All Console Kit widgets are registered here. The catalog is passed to
 * WidgetGrid for layout and WidgetPicker for discovery.
 */

import type { WidgetManifest } from '@estream/sdk-browser/widgets';

// Impact widgets (#23)
import { IMPACT_COUNTER_MANIFEST } from './impact-counter/manifest';
import { IMPACT_CERTIFICATE_MANIFEST } from './impact-certificate/manifest';
import { IMPACT_LIVE_METER_MANIFEST } from './impact-live-meter/manifest';
import { IMPACT_LEADERBOARD_MANIFEST } from './impact-leaderboard/manifest';

// Operations widgets (#12/#17)
import { CREDIT_REGISTRY_MANIFEST } from './credit-registry/manifest';
import { ATTESTATION_MONITOR_MANIFEST } from './attestation-monitor/manifest';
import { MARKETPLACE_MANIFEST } from './marketplace/manifest';
import { RETIREMENT_ENGINE_MANIFEST } from './retirement-engine/manifest';
import { AUDIT_TRAIL_MANIFEST } from './audit-trail/manifest';
import { GOVERNANCE_MANIFEST } from './governance/manifest';

// Analytics widgets (#12/#17)
import { YIELD_FORECAST_MANIFEST } from './yield-forecast/manifest';
import { FORWARD_CONTRACTS_MANIFEST } from './forward-contracts/manifest';
import { RISK_MONITOR_MANIFEST } from './risk-monitor/manifest';
import { PRICING_ORACLE_MANIFEST } from './pricing-oracle/manifest';

export const WIDGET_CATALOG: WidgetManifest[] = [
  // Impact (#23)
  IMPACT_COUNTER_MANIFEST,
  IMPACT_CERTIFICATE_MANIFEST,
  IMPACT_LIVE_METER_MANIFEST,
  IMPACT_LEADERBOARD_MANIFEST,

  // Operations (#12/#17)
  CREDIT_REGISTRY_MANIFEST,
  ATTESTATION_MONITOR_MANIFEST,
  MARKETPLACE_MANIFEST,
  RETIREMENT_ENGINE_MANIFEST,
  AUDIT_TRAIL_MANIFEST,
  GOVERNANCE_MANIFEST,

  // Analytics (#12/#17)
  YIELD_FORECAST_MANIFEST,
  FORWARD_CONTRACTS_MANIFEST,
  RISK_MONITOR_MANIFEST,
  PRICING_ORACLE_MANIFEST,
];
