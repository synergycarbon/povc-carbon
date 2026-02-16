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

// Operational widgets will be added by #12/#17
// import { CREDIT_REGISTRY_MANIFEST } from './credit-registry/manifest';
// ... etc

export const WIDGET_CATALOG: WidgetManifest[] = [
  // Impact (#23)
  IMPACT_COUNTER_MANIFEST,
  IMPACT_CERTIFICATE_MANIFEST,
  IMPACT_LIVE_METER_MANIFEST,
  IMPACT_LEADERBOARD_MANIFEST,

  // Operations (#12/#17) — to be added
  // Analytics (#12/#17) — to be added
];
