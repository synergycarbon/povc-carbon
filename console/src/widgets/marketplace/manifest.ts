import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const MARKETPLACE_MANIFEST: WidgetManifest = {
  id: 'sc-marketplace',
  name: 'Marketplace',
  description: 'Browse and trade carbon credits with real-time order book and settlement tracking',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'buyer',
  roles: ['buyer'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/marketplace/listings/listed',
      'esn://sustainability/carbon/org/synergycarbon/marketplace/listings/settled',
      'esn://sustainability/carbon/org/synergycarbon/marketplace/listings/cancelled',
    ],
    eslite_tables: ['marketplace_listings', 'carbon_credits'],
    graph: 'marketplace_orderbook',
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
