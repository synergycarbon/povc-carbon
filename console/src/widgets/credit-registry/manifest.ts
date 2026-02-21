import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const CREDIT_REGISTRY_MANIFEST: WidgetManifest = {
  id: 'sc-credit-registry',
  name: 'Credit Registry',
  description: 'Browse carbon credit NFTs with status tracking, filterable by vintage, methodology, and source type',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'owner',
  roles: ['owner'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/issued',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/transferred',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/retired',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/cancelled',
      'esn://sustainability/carbon/org/synergycarbon/registry/credits/state',
    ],
    eslite_tables: ['carbon_credits', 'attestations'],
    graph: 'credit_registry',
  },
  size: {
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: ['retire_credits'],
  icon: 'registry',
};
