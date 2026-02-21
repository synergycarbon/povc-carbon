import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const IMPACT_COUNTER_MANIFEST: WidgetManifest = {
  id: 'sc-impact-counter',
  name: 'Impact Counter',
  description: 'Running total of CO2e retired by an entity, with year/month breakdowns',
  category: 'impact',
  version: '1.1.0',
  visibility_tier: 'public',
  roles: ['public'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/registry/impact/updates',
    ],
    eslite_tables: ['entity_impacts'],
    graph: 'impact_aggregator',
  },
  size: {
    min_width: 2,
    min_height: 1,
    default_width: 3,
    default_height: 2,
  },
  spark_actions: [],
  icon: 'counter',
  embeddable: true,
};
