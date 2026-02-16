/**
 * Risk Monitor Widget
 *
 * Combines AI yield forecasts with forward curve pricing to present:
 * - Yield risk (confidence spread as % of point estimate)
 * - Price risk (curve volatility across tenors)
 * - Combined exposure metrics
 * - Risk heat indicators
 */

import React, { useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { YieldForecast, ForwardCurve } from '@/types';
import { RISK_MONITOR_MANIFEST } from './manifest';

type RiskLevel = 'low' | 'medium' | 'high';

export function RiskMonitorWidget(): React.ReactElement {
  const theme = useEStreamTheme();

  const latestForecast = useWidgetSubscription<YieldForecast>('lex://sc/ai/forecast');
  const latestCurve = useWidgetSubscription<ForwardCurve>('lex://sc/ai/forward_curve');

  const cachedForecasts = useEsliteQuery<YieldForecast>('yield_forecasts', {
    orderBy: 'generated_at',
    order: 'desc',
    limit: 1,
  });

  const cachedCurves = useEsliteQuery<ForwardCurve>('forward_curves', {
    orderBy: 'generated_at',
    order: 'desc',
    limit: 1,
  });

  const forecast = latestForecast ?? cachedForecasts?.[0];
  const curve = latestCurve ?? cachedCurves?.[0];

  const yieldRisk = useMemo((): { spread: number; level: RiskLevel } => {
    if (!forecast) return { spread: 0, level: 'low' };
    const spread = forecast.point_estimate > 0
      ? ((forecast.confidence_upper - forecast.confidence_lower) / forecast.point_estimate) * 100
      : 0;
    const level: RiskLevel = spread > 50 ? 'high' : spread > 25 ? 'medium' : 'low';
    return { spread, level };
  }, [forecast]);

  const priceRisk = useMemo((): { volatility: number; level: RiskLevel } => {
    if (!curve || curve.curve.length < 2) return { volatility: 0, level: 'low' };
    const prices = curve.curve.map(p => p.price_usd);
    const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
    const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
    const volatility = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;
    const level: RiskLevel = volatility > 30 ? 'high' : volatility > 15 ? 'medium' : 'low';
    return { volatility, level };
  }, [curve]);

  const overallRisk: RiskLevel =
    yieldRisk.level === 'high' || priceRisk.level === 'high'
      ? 'high'
      : yieldRisk.level === 'medium' || priceRisk.level === 'medium'
        ? 'medium'
        : 'low';

  return (
    <WidgetFrame manifest={RISK_MONITOR_MANIFEST}>
      <div className="sc-risk-monitor" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-risk-monitor__title">Risk Monitor</h3>

        <div className="sc-risk-monitor__overall">
          <div
            className="sc-risk-monitor__overall-indicator"
            style={{ backgroundColor: riskColor(overallRisk, theme) }}
          />
          <span className="sc-risk-monitor__overall-label">
            Overall Risk: {overallRisk.toUpperCase()}
          </span>
        </div>

        <div className="sc-risk-monitor__cards">
          <div className="sc-risk-monitor__card">
            <div className="sc-risk-monitor__card-header">
              <span className="sc-risk-monitor__card-title">Yield Risk</span>
              <span
                className="sc-risk-monitor__card-badge"
                style={{ backgroundColor: riskColor(yieldRisk.level, theme) }}
              >
                {yieldRisk.level}
              </span>
            </div>
            {forecast ? (
              <div className="sc-risk-monitor__card-body">
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Confidence Spread</span>
                  <span className="sc-risk-monitor__stat-value">{yieldRisk.spread.toFixed(1)}%</span>
                </div>
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Point Estimate</span>
                  <span className="sc-risk-monitor__stat-value">
                    {formatTonnes(forecast.point_estimate)} tCO2e
                  </span>
                </div>
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Range</span>
                  <span className="sc-risk-monitor__stat-value">
                    {formatTonnes(forecast.confidence_lower)} – {formatTonnes(forecast.confidence_upper)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="sc-risk-monitor__card-empty">No forecast data</div>
            )}
          </div>

          <div className="sc-risk-monitor__card">
            <div className="sc-risk-monitor__card-header">
              <span className="sc-risk-monitor__card-title">Price Risk</span>
              <span
                className="sc-risk-monitor__card-badge"
                style={{ backgroundColor: riskColor(priceRisk.level, theme) }}
              >
                {priceRisk.level}
              </span>
            </div>
            {curve ? (
              <div className="sc-risk-monitor__card-body">
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Volatility</span>
                  <span className="sc-risk-monitor__stat-value">{priceRisk.volatility.toFixed(1)}%</span>
                </div>
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Spot Price</span>
                  <span className="sc-risk-monitor__stat-value">${curve.spot_price_usd.toFixed(2)}</span>
                </div>
                <div className="sc-risk-monitor__stat">
                  <span className="sc-risk-monitor__stat-label">Tenors</span>
                  <span className="sc-risk-monitor__stat-value">{curve.curve.length} points</span>
                </div>
              </div>
            ) : (
              <div className="sc-risk-monitor__card-empty">No pricing data</div>
            )}
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}

function riskColor(
  level: RiskLevel,
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  switch (level) {
    case 'low': return theme.tokens['--es-color-success'] ?? '#22c55e';
    case 'medium': return theme.tokens['--es-color-warning'] ?? '#f59e0b';
    case 'high': return theme.tokens['--es-color-error'] ?? '#ef4444';
  }
}

function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

RiskMonitorWidget.manifest = RISK_MONITOR_MANIFEST;
