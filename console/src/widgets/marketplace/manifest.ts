import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const MARKETPLACE_MANIFEST: WidgetManifest = {
  id: 'sc-marketplace',
  name: 'Marketplace',
  description: 'Browse and trade carbon credits with real-time order book and settlement tracking',
  category: 'operations',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: [
      'lex://sc/marketplace/listed',
      'lex://sc/marketplace/settled',
      'lex://sc/marketplace/cancelled',
      'lex://sc/credits/issued',
      'lex://sc/credits/transferred',
      'lex://sc/credits/retired',
      'lex://sc/credits/cancelled',
    ],
    eslite_tables: ['marketplace_listings', 'carbon_credits'],
  },
  size: {
    min_width: 4,
    min_height: 3,
    default_width: 6,
    default_height: 4,
  },
  spark_actions: ['place_order', 'cancel_listing'],
  icon: 'marketplace',
};
