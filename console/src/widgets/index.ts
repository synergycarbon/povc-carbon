/**
 * SynergyCarbon Widget Catalog — Registration Barrel
 *
 * All Console Kit widgets are registered here. The catalog is passed to
 * WidgetGrid for layout and WidgetPicker for discovery.
 *
 * Widgets are added as their issues are implemented:
 * - #23: Impact widgets (counter, certificate, live-meter, leaderboard)
 * - #12/#17: Operational widgets (credit-registry, attestation-monitor,
 *   marketplace, retirement-engine, audit-trail, governance,
 *   yield-forecast, forward-contracts, risk-monitor, pricing-oracle)
 */

import type { WidgetManifest } from '@estream/sdk-browser/widgets';

// Widget manifests will be imported as they are created
// import { IMPACT_COUNTER_MANIFEST } from './impact-counter/manifest';
// import { IMPACT_CERTIFICATE_MANIFEST } from './impact-certificate/manifest';
// ... etc

export const WIDGET_CATALOG: WidgetManifest[] = [
  // Populated by #23 and #12/#17
];
