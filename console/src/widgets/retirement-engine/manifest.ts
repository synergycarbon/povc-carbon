import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const RETIREMENT_ENGINE_MANIFEST: WidgetManifest = {
  id: 'sc-retirement-engine',
  name: 'Retirement Engine',
  description: 'Manage retirement triggers, view retirement history, and invoke credit retirements',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'buyer',
  roles: ['buyer'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/retirements/triggered',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/retirements/confirmed',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/retired',
    ],
    eslite_tables: ['retirements', 'carbon_credits'],
    graph: 'credit_registry',
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
