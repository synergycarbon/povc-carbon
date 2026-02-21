import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const GOVERNANCE_MANIFEST: WidgetManifest = {
  id: 'sc-governance',
  name: 'Governance',
  description: 'Manage governance proposals, voting, methodology approvals, and verifier registration',
  category: 'operations',
  version: '1.1.0',
  visibility_tier: 'auditor',
  roles: ['auditor'],
  data_sources: {
    lex_topics: [
      'esn://sustainability/carbon/org/synergycarbon/governance/proposals/result',
      'esn://sustainability/carbon/org/synergycarbon/governance/methodology/approved',
      'esn://sustainability/carbon/org/synergycarbon/governance/verifier/registered',
      'esn://sustainability/carbon/org/synergycarbon/governance/parameters/updated',
    ],
    eslite_tables: ['governance_proposals', 'methodologies', 'verifiers'],
    graph: 'governance_dag',
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
