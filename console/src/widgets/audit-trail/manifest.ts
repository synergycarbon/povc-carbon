import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const AUDIT_TRAIL_MANIFEST: WidgetManifest = {
  id: 'sc-audit-trail',
  name: 'Audit Trail',
  description: 'Hash-chained audit event log with filtering, search, and export for compliance review',
  category: 'operations',
  version: '1.0.0',
  roles: ['auditor'],
  data_sources: {
    lex_topics: ['lex://sc/audit/events'],
    eslite_tables: ['audit_events'],
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
