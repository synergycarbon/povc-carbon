import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const IMPACT_LIVE_METER_MANIFEST: WidgetManifest = {
  id: 'sc-impact-live-meter',
  name: 'Impact Live Meter',
  description: 'Real-time energy generation and carbon offset meter with <1s latency',
  category: 'impact',
  version: '1.0.0',
  roles: ['public'],
  data_sources: {
    lex_topics: ['lex://sc/attestations/verified', 'lex://sc/impact/updates'],
    eslite_tables: ['attestations', 'entity_impacts'],
  },
  size: {
    min_width: 2,
    min_height: 2,
    default_width: 3,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'meter',
  embeddable: true,
};
