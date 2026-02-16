import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const FORWARD_CONTRACTS_MANIFEST: WidgetManifest = {
  id: 'sc-forward-contracts',
  name: 'Forward Contracts',
  description: 'Manage forward carbon credit contracts with delivery tracking and settlement status',
  category: 'analytics',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: [
      'lex://sc/contracts/proposed',
      'lex://sc/contracts/accepted',
      'lex://sc/contracts/delivery',
      'lex://sc/contracts/settled',
    ],
    eslite_tables: ['forward_contracts'],
  },
  size: {
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: ['sign_contract'],
  icon: 'contract',
};
