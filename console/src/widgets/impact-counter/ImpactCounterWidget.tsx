/**
 * Impact Counter Widget
 *
 * @graph   impact_aggregator — reads aggregated retirement totals from the registry DAG
 * @overlay Running totals: all-time tCO2e retired, year breakdown, month breakdown
 * @rbac    public — no auth required; embeddable
 *
 * Displays a running total of CO2e retired for an entity.
 * Subscribes to graph-backed registry impact topic via WebTransport for real-time updates.
 * Falls back to ESLite cache for offline display.
 */

import React from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { EntityImpact } from '@/types';
import { IMPACT_COUNTER_MANIFEST } from './manifest';

interface ImpactCounterProps {
  entity_id?: string;
}

export function ImpactCounterWidget({ entity_id }: ImpactCounterProps): React.ReactElement {
  const theme = useEStreamTheme();

  const liveData = useWidgetSubscription<EntityImpact>(
    'esn://sustainability/carbon/org/synergycarbon/registry/impact/updates',
    { filter: entity_id ? { entity_id } : undefined },
  );

  const cachedData = useEsliteQuery<EntityImpact>('entity_impacts', {
    where: entity_id ? { entity_id } : undefined,
    orderBy: 'total_tco2e_retired',
    order: 'desc',
    limit: 1,
  });

  const impact = liveData ?? cachedData?.[0];
  const totalTonnes = impact?.total_tco2e_retired ?? 0;
  const thisYear = impact?.total_tco2e_this_year ?? 0;
  const thisMonth = impact?.total_tco2e_this_month ?? 0;

  return (
    <WidgetFrame manifest={IMPACT_COUNTER_MANIFEST}>
      <div className="sc-impact-counter" style={{ color: theme.tokens['--es-color-text'] }}>
        <div className="sc-impact-counter__total">
          <span className="sc-impact-counter__value">
            {formatTonnes(totalTonnes)}
          </span>
          <span className="sc-impact-counter__unit">tCO2e retired</span>
        </div>

        <div className="sc-impact-counter__breakdown">
          <div className="sc-impact-counter__period">
            <span className="sc-impact-counter__period-value">{formatTonnes(thisYear)}</span>
            <span className="sc-impact-counter__period-label">This Year</span>
          </div>
          <div className="sc-impact-counter__period">
            <span className="sc-impact-counter__period-value">{formatTonnes(thisMonth)}</span>
            <span className="sc-impact-counter__period-label">This Month</span>
          </div>
        </div>

        {impact?.entity_name && (
          <div className="sc-impact-counter__entity">{impact.entity_name}</div>
        )}
      </div>
    </WidgetFrame>
  );
}

function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

ImpactCounterWidget.manifest = IMPACT_COUNTER_MANIFEST;
