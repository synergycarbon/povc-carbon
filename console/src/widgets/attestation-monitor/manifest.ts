import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const ATTESTATION_MONITOR_MANIFEST: WidgetManifest = {
  id: 'sc-attestation-monitor',
  name: 'Attestation Monitor',
  description: 'Real-time attestation feed for auditors showing verified and rejected attestations',
  category: 'operations',
  version: '1.0.0',
  roles: ['auditor'],
  data_sources: {
    lex_topics: [
      'lex://sc/attestations/verified',
      'lex://sc/attestations/rejected',
    ],
    eslite_tables: ['attestations'],
  },
  size: {
    min_width: 3,
    min_height: 2,
    default_width: 4,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'attestation',
};
