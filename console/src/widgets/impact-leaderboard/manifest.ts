import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const IMPACT_LEADERBOARD_MANIFEST: WidgetManifest = {
  id: 'sc-impact-leaderboard',
  name: 'Impact Leaderboard',
  description: 'Multi-entity comparison of carbon retirement impact, ranked by tCO2e',
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
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: [],
  icon: 'leaderboard',
  embeddable: true,
};
