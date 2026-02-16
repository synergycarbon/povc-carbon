/**
 * Forward Contracts Widget
 *
 * Manages forward carbon credit contracts:
 * - View contract pipeline with status tracking
 * - Monitor delivery progress against schedule
 * - Real-time updates on proposals, acceptances, and settlements
 * - Sign contracts via Spark action
 */

import React, { useState, useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { ForwardContract, ContractStatus } from '@/types';
import { FORWARD_CONTRACTS_MANIFEST } from './manifest';

export function ForwardContractsWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');

  useWidgetSubscription<ForwardContract>('lex://sc/contracts/proposed');
  useWidgetSubscription<ForwardContract>('lex://sc/contracts/accepted');
  useWidgetSubscription<ForwardContract>('lex://sc/contracts/delivery');
  useWidgetSubscription<ForwardContract>('lex://sc/contracts/settled');

  const contracts = useEsliteQuery<ForwardContract>('forward_contracts', {
    orderBy: 'created_at',
    order: 'desc',
    limit: 50,
  });

  const filtered = useMemo(() => {
    if (!contracts) return [];
    if (!statusFilter) return contracts;
    return contracts.filter(c => c.status === statusFilter);
  }, [contracts, statusFilter]);

  const totalValue = filtered.reduce(
    (sum, c) => sum + c.total_tonnes * c.price_per_tonne_usd,
    0,
  );
  const totalTonnes = filtered.reduce((sum, c) => sum + c.total_tonnes, 0);
  const totalDelivered = filtered.reduce((sum, c) => sum + c.delivered_tonnes, 0);

  return (
    <WidgetFrame manifest={FORWARD_CONTRACTS_MANIFEST}>
      <div className="sc-forward-contracts" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-forward-contracts__title">Forward Contracts</h3>

        <div className="sc-forward-contracts__summary">
          <div className="sc-forward-contracts__metric">
            <span className="sc-forward-contracts__metric-value">{filtered.length}</span>
            <span className="sc-forward-contracts__metric-label">Contracts</span>
          </div>
          <div className="sc-forward-contracts__metric">
            <span className="sc-forward-contracts__metric-value">
              ${formatCurrency(totalValue)}
            </span>
            <span className="sc-forward-contracts__metric-label">Total Value</span>
          </div>
          <div className="sc-forward-contracts__metric">
            <span className="sc-forward-contracts__metric-value">
              {formatTonnes(totalDelivered)}/{formatTonnes(totalTonnes)}
            </span>
            <span className="sc-forward-contracts__metric-label">Delivered</span>
          </div>
        </div>

        <div className="sc-forward-contracts__filters">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter((e.target.value || '') as ContractStatus | '')}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Statuses</option>
            <option value="Proposed">Proposed</option>
            <option value="Active">Active</option>
            <option value="Delivering">Delivering</option>
            <option value="Settled">Settled</option>
            <option value="Defaulted">Defaulted</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>

        {!filtered.length ? (
          <div className="sc-forward-contracts__empty">No contracts found</div>
        ) : (
          <ul className="sc-forward-contracts__list">
            {filtered.map((contract, idx) => {
              const deliveryPct = contract.total_tonnes > 0
                ? (contract.delivered_tonnes / contract.total_tonnes) * 100
                : 0;

              return (
                <li key={idx} className="sc-forward-contracts__item">
                  <div className="sc-forward-contracts__item-header">
                    <span className="sc-forward-contracts__methodology">
                      {contract.methodology_id}
                    </span>
                    <span className="sc-forward-contracts__source">{contract.source_type}</span>
                    <span
                      className="sc-forward-contracts__status"
                      style={{ color: contractStatusColor(contract.status, theme) }}
                    >
                      {contract.status}
                    </span>
                  </div>

                  <div className="sc-forward-contracts__item-details">
                    <span>{formatTonnes(contract.total_tonnes)} tCO2e</span>
                    <span>${contract.price_per_tonne_usd.toFixed(2)}/t</span>
                    <span>{contract.delivery_schedule}</span>
                  </div>

                  <div className="sc-forward-contracts__delivery-bar">
                    <div
                      className="sc-forward-contracts__delivery-fill"
                      style={{
                        width: `${deliveryPct}%`,
                        backgroundColor: theme.tokens['--es-color-primary'],
                      }}
                    />
                    <span className="sc-forward-contracts__delivery-label">
                      {deliveryPct.toFixed(1)}% delivered
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WidgetFrame>
  );
}

function contractStatusColor(
  status: ContractStatus,
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  switch (status) {
    case 'Proposed': return theme.tokens['--es-color-info'] ?? '#3b82f6';
    case 'Active': return theme.tokens['--es-color-primary'] ?? '#10b981';
    case 'Delivering': return theme.tokens['--es-color-warning'] ?? '#f59e0b';
    case 'Settled': return theme.tokens['--es-color-success'] ?? '#22c55e';
    case 'Defaulted': return theme.tokens['--es-color-error'] ?? '#ef4444';
    case 'Terminated': return theme.tokens['--es-color-muted'] ?? '#6b7280';
  }
}

function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

ForwardContractsWidget.manifest = FORWARD_CONTRACTS_MANIFEST;
