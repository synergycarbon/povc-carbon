import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const RETIREMENT_ENGINE_MANIFEST: WidgetManifest = {
  id: 'sc-retirement-engine',
  name: 'Retirement Engine',
  description: 'Manage retirement triggers, view retirement history, and invoke credit retirements',
  category: 'operations',
  version: '1.0.0',
  roles: ['owner'],
  data_sources: {
    lex_topics: [
      'lex://sc/retirements/triggered',
      'lex://sc/retirements/confirmed',
      'lex://sc/credits/retired',
    ],
    eslite_tables: ['retirements', 'carbon_credits'],
  },
  size: {
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: ['retire_credits', 'create_trigger'],
  icon: 'retirement',
};
