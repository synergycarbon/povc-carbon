/**
 * Impact Leaderboard Widget
 *
 * Ranks entities by total tCO2e retired. Real-time updates via
 * WebTransport lex subscription. Supports configurable max entries
 * and time range filtering.
 */

import React from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { EntityImpact } from '@/types';
import { IMPACT_LEADERBOARD_MANIFEST } from './manifest';

interface ImpactLeaderboardProps {
  max_entries?: number;
}

export function ImpactLeaderboardWidget({
  max_entries = 25,
}: ImpactLeaderboardProps): React.ReactElement {
  const theme = useEStreamTheme();

  const entities = useEsliteQuery<EntityImpact>('entity_impacts', {
    orderBy: 'total_tco2e_retired',
    order: 'desc',
    limit: max_entries,
  });

  useWidgetSubscription<EntityImpact>('lex://sc/impact/updates');

  const maxTonnes = entities?.[0]?.total_tco2e_retired ?? 1;

  return (
    <WidgetFrame manifest={IMPACT_LEADERBOARD_MANIFEST}>
      <div className="sc-leaderboard" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-leaderboard__title">Carbon Impact Leaderboard</h3>

        {!entities?.length ? (
          <div className="sc-leaderboard__empty">No impact data available</div>
        ) : (
          <div className="sc-leaderboard__table">
            <div className="sc-leaderboard__header">
              <span className="sc-leaderboard__col-rank">#</span>
              <span className="sc-leaderboard__col-name">Entity</span>
              <span className="sc-leaderboard__col-total">tCO2e Retired</span>
              <span className="sc-leaderboard__col-bar" />
            </div>

            {entities.map((entity, index) => (
              <div key={index} className="sc-leaderboard__row">
                <span className="sc-leaderboard__rank">{index + 1}</span>
                <span className="sc-leaderboard__name">{entity.entity_name}</span>
                <span className="sc-leaderboard__total">
                  {formatTonnes(entity.total_tco2e_retired)}
                </span>
                <div className="sc-leaderboard__bar-container">
                  <div
                    className="sc-leaderboard__bar"
                    style={{
                      width: `${(entity.total_tco2e_retired / maxTonnes) * 100}%`,
                      backgroundColor: theme.tokens['--es-color-primary'],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
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

ImpactLeaderboardWidget.manifest = IMPACT_LEADERBOARD_MANIFEST;
