import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const GOVERNANCE_MANIFEST: WidgetManifest = {
  id: 'sc-governance',
  name: 'Governance',
  description: 'Manage governance proposals, voting, methodology approvals, and verifier registration',
  category: 'operations',
  version: '1.0.0',
  roles: ['owner'],
  data_sources: {
    lex_topics: [
      'lex://sc/governance/proposals/result',
      'lex://sc/governance/methodology/approved',
      'lex://sc/governance/verifier/registered',
      'lex://sc/governance/parameters/updated',
    ],
    eslite_tables: ['governance_proposals', 'methodologies', 'verifiers'],
  },
  size: {
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: ['governance_vote', 'propose_methodology', 'register_verifier'],
  icon: 'governance',
};
