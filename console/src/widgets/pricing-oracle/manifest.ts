import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const PRICING_ORACLE_MANIFEST: WidgetManifest = {
  id: 'sc-pricing-oracle',
  name: 'Pricing Oracle',
  description: 'Forward curve visualization with spot price, tenor-based pricing, and confidence intervals',
  category: 'analytics',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: ['lex://sc/ai/forward_curve'],
    eslite_tables: ['forward_curves'],
  },
  size: {
    min_width: 3,
    min_height: 2,
    default_width: 4,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'pricing',
};
