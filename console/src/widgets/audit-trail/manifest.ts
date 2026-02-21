import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const AUDIT_TRAIL_MANIFEST: WidgetManifest = {
  id: 'sc-audit-trail',
  name: 'Audit Trail',
  description: 'Hash-chained audit event log with filtering, search, and export for compliance review',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'auditor',
  roles: ['auditor'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/audit/events',
      'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/compliance/audit/events',
    ],
    eslite_tables: ['audit_events'],
    graph: 'compliance_chain',
  },
  size: {
    min_width: 4,
    min_height: 2,
    default_width: 6,
    default_height: 3,
  },
  spark_actions: [],
  icon: 'audit',
};
