import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const YIELD_FORECAST_MANIFEST: WidgetManifest = {
  id: 'sc-yield-forecast',
  name: 'Yield Forecast',
  description: 'AI-powered carbon credit yield predictions with confidence intervals and model versioning',
  category: 'analytics',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: ['lex://sc/ai/forecast'],
    eslite_tables: ['yield_forecasts'],
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
