/**
 * Governance Widget
 *
 * @graph   governance_dag — reads the DAG of governance proposals, votes, and outcomes
 * @overlay Proposals (pending/approved/rejected), methodology approvals, verifier registrations
 * @rbac    auditor — visible to auditor tier and above
 *
 * Comprehensive governance interface:
 * - Browse and vote on proposals (methodology, verifier, parameter)
 * - View methodology registry with status
 * - Register new verifiers
 * - Real-time governance event feed via graph-backed topics
 */

import React, { useState, useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { GovernanceProposal, Methodology, ProposalType } from '@/types';
import { GOVERNANCE_MANIFEST } from './manifest';

type GovernanceTab = 'proposals' | 'methodologies';

export function GovernanceWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [activeTab, setActiveTab] = useState<GovernanceTab>('proposals');
  const [proposalTypeFilter, setProposalTypeFilter] = useState<ProposalType | ''>('');

  useWidgetSubscription<GovernanceProposal>(
    'esn://sustainability/carbon/org/synergycarbon/governance/proposals/result',
  );
  useWidgetSubscription<Methodology>(
    'esn://sustainability/carbon/org/synergycarbon/governance/methodology/approved',
  );
  useWidgetSubscription(
    'esn://sustainability/carbon/org/synergycarbon/governance/verifier/registered',
  );
  useWidgetSubscription(
    'esn://sustainability/carbon/org/synergycarbon/governance/parameters/updated',
  );

  const proposals = useEsliteQuery<GovernanceProposal>('governance_proposals', {
    orderBy: 'created_at',
    order: 'desc',
    limit: 50,
  });

  const methodologies = useEsliteQuery<Methodology>('methodologies', {
    orderBy: 'approved_at',
    order: 'desc',
    limit: 50,
  });

  const filteredProposals = useMemo(() => {
    if (!proposals) return [];
    if (!proposalTypeFilter) return proposals;
    return proposals.filter(p => p.proposal_type === proposalTypeFilter);
  }, [proposals, proposalTypeFilter]);

  const pendingCount = proposals?.filter(p => p.status === 'pending').length ?? 0;

  return (
    <WidgetFrame manifest={GOVERNANCE_MANIFEST}>
      <div className="sc-governance" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-governance__title">Governance</h3>

        <div className="sc-governance__tabs">
          <button
            className={`sc-governance__tab ${activeTab === 'proposals' ? 'sc-governance__tab--active' : ''}`}
            onClick={() => setActiveTab('proposals')}
            style={activeTab === 'proposals' ? { borderBottom: `2px solid ${theme.tokens['--es-color-primary']}` } : {}}
          >
            Proposals {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            className={`sc-governance__tab ${activeTab === 'methodologies' ? 'sc-governance__tab--active' : ''}`}
            onClick={() => setActiveTab('methodologies')}
            style={activeTab === 'methodologies' ? { borderBottom: `2px solid ${theme.tokens['--es-color-primary']}` } : {}}
          >
            Methodologies ({methodologies?.length ?? 0})
          </button>
        </div>

        {activeTab === 'proposals' && (
          <div className="sc-governance__proposals">
            <div className="sc-governance__proposal-filters">
              <select
                value={proposalTypeFilter}
                onChange={e => setProposalTypeFilter((e.target.value || '') as ProposalType | '')}
                style={{ background: theme.tokens['--es-color-surface'] }}
              >
                <option value="">All Types</option>
                <option value="methodology_approval">Methodology Approval</option>
                <option value="verifier_registration">Verifier Registration</option>
                <option value="parameter_change">Parameter Change</option>
                <option value="verifier_revocation">Verifier Revocation</option>
              </select>
            </div>

            {!filteredProposals.length ? (
              <div className="sc-governance__empty">No proposals found</div>
            ) : (
              <ul className="sc-governance__proposal-list">
                {filteredProposals.map((proposal, idx) => (
                  <li key={idx} className="sc-governance__proposal-item">
                    <div className="sc-governance__proposal-header">
                      <span className="sc-governance__proposal-title">{proposal.title}</span>
                      <span
                        className="sc-governance__proposal-status"
                        style={{ color: proposalStatusColor(proposal.status, theme) }}
                      >
                        {proposal.status}
                      </span>
                    </div>
                    <div className="sc-governance__proposal-meta">
                      <span className="sc-governance__proposal-type">
                        {proposal.proposal_type.replace(/_/g, ' ')}
                      </span>
                      <span className="sc-governance__proposal-date">
                        {new Date(proposal.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="sc-governance__proposal-votes">
                      <span
                        className="sc-governance__vote-for"
                        style={{ color: theme.tokens['--es-color-success'] ?? '#22c55e' }}
                      >
                        For: {proposal.votes_for}
                      </span>
                      <span
                        className="sc-governance__vote-against"
                        style={{ color: theme.tokens['--es-color-error'] ?? '#ef4444' }}
                      >
                        Against: {proposal.votes_against}
                      </span>
                      <div className="sc-governance__vote-bar">
                        <div
                          className="sc-governance__vote-bar-fill"
                          style={{
                            width: `${votePercent(proposal.votes_for, proposal.votes_against)}%`,
                            backgroundColor: theme.tokens['--es-color-success'] ?? '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                    <p className="sc-governance__proposal-desc">{proposal.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'methodologies' && (
          <div className="sc-governance__methodologies">
            {!methodologies?.length ? (
              <div className="sc-governance__empty">No methodologies registered</div>
            ) : (
              <ul className="sc-governance__methodology-list">
                {methodologies.map((m, idx) => (
                  <li key={idx} className="sc-governance__methodology-item">
                    <div className="sc-governance__methodology-header">
                      <span className="sc-governance__methodology-name">
                        {m.name} v{m.version}
                      </span>
                      <span
                        className="sc-governance__methodology-status"
                        style={{ color: methodologyStatusColor(m.status, theme) }}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div className="sc-governance__methodology-meta">
                      <span>Sources: {m.source_types.join(', ')}</span>
                      <span>Model: {m.emission_factor_model}</span>
                      <span>Registries: {m.registry_compatibility.join(', ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

function proposalStatusColor(
  status: GovernanceProposal['status'],
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  switch (status) {
    case 'pending': return theme.tokens['--es-color-warning'] ?? '#f59e0b';
    case 'approved': return theme.tokens['--es-color-success'] ?? '#22c55e';
    case 'rejected': return theme.tokens['--es-color-error'] ?? '#ef4444';
    case 'expired': return theme.tokens['--es-color-muted'] ?? '#6b7280';
  }
}

function methodologyStatusColor(
  status: Methodology['status'],
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  switch (status) {
    case 'approved': return theme.tokens['--es-color-success'] ?? '#22c55e';
    case 'test': return theme.tokens['--es-color-warning'] ?? '#f59e0b';
    case 'deprecated': return theme.tokens['--es-color-muted'] ?? '#6b7280';
  }
}

function votePercent(votesFor: number, votesAgainst: number): number {
  const total = votesFor + votesAgainst;
  return total === 0 ? 50 : (votesFor / total) * 100;
}

GovernanceWidget.manifest = GOVERNANCE_MANIFEST;
