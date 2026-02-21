import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const RISK_MONITOR_MANIFEST: WidgetManifest = {
  id: 'sc-risk-monitor',
  name: 'Risk Monitor',
  description: 'Risk dashboard combining AI yield forecasts and forward curve pricing for exposure analysis',
  category: 'analytics',
  version: '1.1.0',
  visibility_tier: 'owner',
  roles: ['owner'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/ops/ai/forecast',
      'esn://sustainability/carbon/org/synergycarbon/ops/ai/forward_curve',
    ],
    eslite_tables: ['yield_forecasts', 'forward_curves'],
    graph: 'risk_model',
  },
  size: {
    min_width: 3,
    min_height: 2,
    default_width: 4,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'risk',
};
