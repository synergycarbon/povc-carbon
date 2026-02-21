/**
 * Yield Forecast Widget
 *
 * @graph   yield_model — reads AI forecast outputs from the ops DAG
 * @overlay Point estimates with confidence intervals, model version, horizon breakdown
 * @rbac    owner — visible to owner tier only (full access)
 *
 * AI-driven carbon yield predictions with:
 * - Point estimates and confidence intervals
 * - Model version tracking
 * - Horizon-based forecasting (monthly, quarterly, annual)
 * - Real-time updates via graph-backed lex subscription
 */

import React from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { YieldForecast } from '@/types';
import { YIELD_FORECAST_MANIFEST } from './manifest';

export function YieldForecastWidget(): React.ReactElement {
  const theme = useEStreamTheme();

  const latestForecast = useWidgetSubscription<YieldForecast>(
    'esn://sustainability/carbon/org/synergycarbon/ops/ai/forecast',
  );

  const forecasts = useEsliteQuery<YieldForecast>('yield_forecasts', {
    orderBy: 'generated_at',
    order: 'desc',
    limit: 20,
  });

  const displayForecasts = forecasts ?? [];
  const primary = latestForecast ?? displayForecasts[0];

  return (
    <WidgetFrame manifest={YIELD_FORECAST_MANIFEST}>
      <div className="sc-yield-forecast" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-yield-forecast__title">Yield Forecast</h3>

        {primary ? (
          <div className="sc-yield-forecast__primary">
            <div className="sc-yield-forecast__estimate">
              <span className="sc-yield-forecast__point-value">
                {formatTonnes(primary.point_estimate)}
              </span>
              <span className="sc-yield-forecast__unit">tCO2e predicted</span>
            </div>

            <div className="sc-yield-forecast__confidence">
              <div className="sc-yield-forecast__confidence-bar">
                <div
                  className="sc-yield-forecast__confidence-range"
                  style={{
                    left: `${rangePercent(primary.confidence_lower, primary)}%`,
                    width: `${rangePercent(primary.confidence_upper, primary) - rangePercent(primary.confidence_lower, primary)}%`,
                    backgroundColor: theme.tokens['--es-color-primary'],
                    opacity: 0.3,
                  }}
                />
                <div
                  className="sc-yield-forecast__confidence-point"
                  style={{
                    left: `${rangePercent(primary.point_estimate, primary)}%`,
                    backgroundColor: theme.tokens['--es-color-primary'],
                  }}
                />
              </div>
              <div className="sc-yield-forecast__confidence-labels">
                <span>{formatTonnes(primary.confidence_lower)}</span>
                <span>{formatTonnes(primary.confidence_upper)}</span>
              </div>
            </div>

            <div className="sc-yield-forecast__meta">
              <span className="sc-yield-forecast__horizon">Horizon: {primary.horizon}</span>
              <span className="sc-yield-forecast__model">Model: {primary.model_version}</span>
              <span className="sc-yield-forecast__generated">
                {new Date(primary.generated_at).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="sc-yield-forecast__empty">No forecast data available</div>
        )}

        {displayForecasts.length > 1 && (
          <div className="sc-yield-forecast__history">
            <h4 className="sc-yield-forecast__section-title">Forecast History</h4>
            <ul className="sc-yield-forecast__list">
              {displayForecasts.slice(1).map((forecast, idx) => (
                <li key={idx} className="sc-yield-forecast__item">
                  <span className="sc-yield-forecast__item-date">
                    {new Date(forecast.generated_at).toLocaleDateString()}
                  </span>
                  <span className="sc-yield-forecast__item-horizon">{forecast.horizon}</span>
                  <span className="sc-yield-forecast__item-estimate">
                    {formatTonnes(forecast.point_estimate)}
                  </span>
                  <span className="sc-yield-forecast__item-range">
                    [{formatTonnes(forecast.confidence_lower)} – {formatTonnes(forecast.confidence_upper)}]
                  </span>
                </li>
              ))}
            </ul>
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

function rangePercent(value: number, forecast: YieldForecast): number {
  const range = forecast.confidence_upper - forecast.confidence_lower;
  if (range === 0) return 50;
  return ((value - forecast.confidence_lower) / range) * 100;
}

YieldForecastWidget.manifest = YIELD_FORECAST_MANIFEST;
