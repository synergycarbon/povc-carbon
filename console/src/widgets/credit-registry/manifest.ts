import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const CREDIT_REGISTRY_MANIFEST: WidgetManifest = {
  id: 'sc-credit-registry',
  name: 'Credit Registry',
  description: 'Browse carbon credit NFTs with status tracking, filterable by vintage, methodology, and source type',
  category: 'operations',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: [
      'lex://sc/credits/issued',
      'lex://sc/credits/transferred',
      'lex://sc/credits/retired',
      'lex://sc/credits/cancelled',
    ],
    eslite_tables: ['carbon_credits', 'attestations'],
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
