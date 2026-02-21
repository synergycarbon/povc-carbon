/**
 * Credit Registry Widget
 *
 * @graph   credit_registry — reads the DAG of credit issuance, transfer, and retirement
 * @overlay Credit NFT status (Issued/Listed/Sold/Retired/Cancelled), vintage, methodology, source type
 * @rbac    owner — visible to owner tier only (full registry access)
 *
 * Displays carbon credit NFTs with real-time status updates from graph-backed topics.
 * Supports filtering by vintage year, methodology, and source type.
 * Provides retire action via Spark circuit invocation.
 */

import React, { useState, useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { CarbonCredit, CreditStatus, SourceType } from '@/types';
import { CREDIT_REGISTRY_MANIFEST } from './manifest';

interface CreditRegistryFilters {
  vintage_year?: number;
  methodology_id?: string;
  source_type?: SourceType;
  status?: CreditStatus;
}

export function CreditRegistryWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [filters, setFilters] = useState<CreditRegistryFilters>({});

  useWidgetSubscription<CarbonCredit>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/issued',
  );
  useWidgetSubscription<CarbonCredit>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/transferred',
  );
  useWidgetSubscription<CarbonCredit>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/retired',
  );
  useWidgetSubscription<CarbonCredit>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/credits/cancelled',
  );

  const credits = useEsliteQuery<CarbonCredit>('carbon_credits', {
    orderBy: 'issued_at',
    order: 'desc',
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!credits) return [];
    return credits.filter(c => {
      if (filters.vintage_year && c.vintage_year !== filters.vintage_year) return false;
      if (filters.methodology_id && c.methodology_id !== filters.methodology_id) return false;
      if (filters.source_type && c.source_type !== filters.source_type) return false;
      if (filters.status && c.status !== filters.status) return false;
      return true;
    });
  }, [credits, filters]);

  const vintages = useMemo(() => {
    if (!credits) return [];
    return [...new Set(credits.map(c => c.vintage_year))].sort((a, b) => b - a);
  }, [credits]);

  const methodologies = useMemo(() => {
    if (!credits) return [];
    return [...new Set(credits.map(c => c.methodology_id))];
  }, [credits]);

  return (
    <WidgetFrame manifest={CREDIT_REGISTRY_MANIFEST}>
      <div className="sc-credit-registry" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-credit-registry__title">Credit Registry</h3>

        <div className="sc-credit-registry__filters">
          <select
            value={filters.vintage_year ?? ''}
            onChange={e => setFilters(f => ({
              ...f,
              vintage_year: e.target.value ? Number(e.target.value) : undefined,
            }))}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Vintages</option>
            {vintages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            value={filters.methodology_id ?? ''}
            onChange={e => setFilters(f => ({
              ...f,
              methodology_id: e.target.value || undefined,
            }))}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Methodologies</option>
            {methodologies.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={filters.source_type ?? ''}
            onChange={e => setFilters(f => ({
              ...f,
              source_type: (e.target.value || undefined) as SourceType | undefined,
            }))}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Sources</option>
            <option value="thermoelectric">Thermoelectric</option>
            <option value="solar">Solar</option>
            <option value="wind">Wind</option>
            <option value="biogas">Biogas</option>
            <option value="ccs">CCS</option>
            <option value="geothermal">Geothermal</option>
            <option value="hydro">Hydro</option>
            <option value="nature_based">Nature Based</option>
          </select>

          <select
            value={filters.status ?? ''}
            onChange={e => setFilters(f => ({
              ...f,
              status: (e.target.value || undefined) as CreditStatus | undefined,
            }))}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Statuses</option>
            <option value="Issued">Issued</option>
            <option value="Listed">Listed</option>
            <option value="Sold">Sold</option>
            <option value="Retired">Retired</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="sc-credit-registry__count">
          {filtered.length} credit{filtered.length !== 1 ? 's' : ''}
        </div>

        {!filtered.length ? (
          <div className="sc-credit-registry__empty">No credits match current filters</div>
        ) : (
          <div className="sc-credit-registry__table">
            <div className="sc-credit-registry__header">
              <span className="sc-credit-registry__col-serial">Serial</span>
              <span className="sc-credit-registry__col-vintage">Vintage</span>
              <span className="sc-credit-registry__col-source">Source</span>
              <span className="sc-credit-registry__col-tonnes">tCO2e</span>
              <span className="sc-credit-registry__col-status">Status</span>
            </div>

            {filtered.map((credit, idx) => (
              <div key={idx} className="sc-credit-registry__row">
                <span className="sc-credit-registry__serial">{credit.serial_number}</span>
                <span className="sc-credit-registry__vintage">{credit.vintage_year}</span>
                <span className="sc-credit-registry__source">{credit.source_type}</span>
                <span className="sc-credit-registry__tonnes">{credit.tonnes_co2e.toFixed(4)}</span>
                <span
                  className="sc-credit-registry__status"
                  style={{ color: statusColor(credit.status, theme) }}
                >
                  {credit.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

function statusColor(
  status: CreditStatus,
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  switch (status) {
    case 'Issued': return theme.tokens['--es-color-info'] ?? '#3b82f6';
    case 'Listed': return theme.tokens['--es-color-warning'] ?? '#f59e0b';
    case 'Sold': return theme.tokens['--es-color-primary'] ?? '#10b981';
    case 'Retired': return theme.tokens['--es-color-success'] ?? '#22c55e';
    case 'Cancelled': return theme.tokens['--es-color-error'] ?? '#ef4444';
  }
}

CreditRegistryWidget.manifest = CREDIT_REGISTRY_MANIFEST;
