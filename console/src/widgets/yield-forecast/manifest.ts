import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const YIELD_FORECAST_MANIFEST: WidgetManifest = {
  id: 'sc-yield-forecast',
  name: 'Yield Forecast',
  description: 'AI-powered carbon credit yield predictions with confidence intervals and model versioning',
  category: 'analytics',
  version: '1.1.0',
  visibility_tier: 'owner',
  roles: ['owner'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/ops/ai/forecast',
    ],
    eslite_tables: ['yield_forecasts'],
    graph: 'yield_model',
  },
  size: {
    min_width: 3,
    min_height: 2,
    default_width: 4,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'forecast',
};
