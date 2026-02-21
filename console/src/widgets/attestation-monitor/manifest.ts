import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const ATTESTATION_MONITOR_MANIFEST: WidgetManifest = {
  id: 'sc-attestation-monitor',
  name: 'Attestation Monitor',
  description: 'Real-time attestation feed for auditors showing verified and rejected attestations',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'auditor',
  roles: ['auditor'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/attestations/verified',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/attestations/rejected',
    ],
    eslite_tables: ['attestations'],
    graph: 'verification_pipeline',
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
