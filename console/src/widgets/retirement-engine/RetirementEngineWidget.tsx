/**
 * Retirement Engine Widget
 *
 * Manages carbon credit retirement lifecycle:
 * - View retirement history with trigger type breakdown
 * - Monitor real-time retirement events
 * - Create retirement triggers (threshold, schedule, stream)
 * - Invoke manual retirements via Spark
 */

import React, { useState, useEffect } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { Retirement, CarbonCredit, RetirementTriggerType } from '@/types';
import { RETIREMENT_ENGINE_MANIFEST } from './manifest';

export function RetirementEngineWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [triggerFilter, setTriggerFilter] = useState<RetirementTriggerType | ''>('');
  const [recentEvents, setRecentEvents] = useState<Retirement[]>([]);

  const latestTriggered = useWidgetSubscription<Retirement>(
    'lex://sc/retirements/triggered',
  );
  const latestConfirmed = useWidgetSubscription<Retirement>(
    'lex://sc/retirements/confirmed',
  );

  useWidgetSubscription<CarbonCredit>('lex://sc/credits/retired');

  useEffect(() => {
    if (latestTriggered) {
      setRecentEvents(prev => [latestTriggered, ...prev.slice(0, 19)]);
    }
  }, [latestTriggered]);

  useEffect(() => {
    if (latestConfirmed) {
      setRecentEvents(prev => [latestConfirmed, ...prev.slice(0, 19)]);
    }
  }, [latestConfirmed]);

  const retirements = useEsliteQuery<Retirement>('retirements', {
    orderBy: 'retired_at',
    order: 'desc',
    limit: 100,
  });

  const filteredRetirements = retirements?.filter(r =>
    !triggerFilter || r.trigger_type === triggerFilter,
  ) ?? [];

  const totalRetired = filteredRetirements.reduce((sum, r) => sum + r.tonnes_co2e, 0);

  const triggerBreakdown = retirements?.reduce<Record<string, number>>((acc, r) => {
    acc[r.trigger_type] = (acc[r.trigger_type] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <WidgetFrame manifest={RETIREMENT_ENGINE_MANIFEST}>
      <div className="sc-retirement-engine" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-retirement-engine__title">Retirement Engine</h3>

        <div className="sc-retirement-engine__summary">
          <div className="sc-retirement-engine__metric">
            <span className="sc-retirement-engine__metric-value">
              {formatTonnes(totalRetired)}
            </span>
            <span className="sc-retirement-engine__metric-label">Total Retired</span>
          </div>
          <div className="sc-retirement-engine__metric">
            <span className="sc-retirement-engine__metric-value">
              {filteredRetirements.length}
            </span>
            <span className="sc-retirement-engine__metric-label">Retirements</span>
          </div>
          <div className="sc-retirement-engine__metric">
            <span className="sc-retirement-engine__metric-value">
              {recentEvents.length}
            </span>
            <span className="sc-retirement-engine__metric-label">Live Events</span>
          </div>
        </div>

        <div className="sc-retirement-engine__triggers">
          <h4 className="sc-retirement-engine__section-title">Trigger Breakdown</h4>
          <div className="sc-retirement-engine__trigger-chips">
            <button
              className={`sc-retirement-engine__chip ${!triggerFilter ? 'sc-retirement-engine__chip--active' : ''}`}
              onClick={() => setTriggerFilter('')}
            >
              All
            </button>
            {Object.entries(triggerBreakdown).map(([type, count]) => (
              <button
                key={type}
                className={`sc-retirement-engine__chip ${triggerFilter === type ? 'sc-retirement-engine__chip--active' : ''}`}
                onClick={() => setTriggerFilter(type as RetirementTriggerType)}
                style={triggerFilter === type ? { backgroundColor: theme.tokens['--es-color-primary'] } : {}}
              >
                {type.replace('_', ' ')} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="sc-retirement-engine__history">
          <h4 className="sc-retirement-engine__section-title">Retirement History</h4>
          {!filteredRetirements.length ? (
            <div className="sc-retirement-engine__empty">No retirements found</div>
          ) : (
            <ul className="sc-retirement-engine__list">
              {filteredRetirements.map((retirement, idx) => (
                <li key={idx} className="sc-retirement-engine__item">
                  <span className="sc-retirement-engine__item-date">
                    {new Date(retirement.retired_at).toLocaleDateString()}
                  </span>
                  <span className="sc-retirement-engine__item-tonnes">
                    {retirement.tonnes_co2e.toFixed(4)} tCO2e
                  </span>
                  <span className="sc-retirement-engine__item-beneficiary">
                    {retirement.beneficiary_name}
                  </span>
                  <span className="sc-retirement-engine__item-trigger">
                    {retirement.trigger_type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}

function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

RetirementEngineWidget.manifest = RETIREMENT_ENGINE_MANIFEST;
