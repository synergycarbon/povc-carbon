/**
 * Pricing Oracle Widget
 *
 * Visualizes the carbon credit forward curve:
 * - Spot price display
 * - Tenor-based price points with confidence intervals
 * - ASCII-style curve visualization
 * - Real-time updates via lex subscription
 */

import React from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { ForwardCurve, ForwardPricePoint } from '@/types';
import { PRICING_ORACLE_MANIFEST } from './manifest';

export function PricingOracleWidget(): React.ReactElement {
  const theme = useEStreamTheme();

  const latestCurve = useWidgetSubscription<ForwardCurve>('lex://sc/ai/forward_curve');

  const cachedCurves = useEsliteQuery<ForwardCurve>('forward_curves', {
    orderBy: 'generated_at',
    order: 'desc',
    limit: 1,
  });

  const curve = latestCurve ?? cachedCurves?.[0];

  const maxPrice = curve
    ? Math.max(curve.spot_price_usd, ...curve.curve.map(p => p.price_usd + p.confidence_interval))
    : 0;

  return (
    <WidgetFrame manifest={PRICING_ORACLE_MANIFEST}>
      <div className="sc-pricing-oracle" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-pricing-oracle__title">Pricing Oracle</h3>

        {curve ? (
          <>
            <div className="sc-pricing-oracle__spot">
              <span className="sc-pricing-oracle__spot-label">Spot Price</span>
              <span className="sc-pricing-oracle__spot-value">
                ${curve.spot_price_usd.toFixed(2)}
              </span>
              <span className="sc-pricing-oracle__spot-unit">/tCO2e</span>
            </div>

            <div className="sc-pricing-oracle__curve">
              <h4 className="sc-pricing-oracle__section-title">Forward Curve</h4>

              <div className="sc-pricing-oracle__chart">
                {curve.curve.map((point, idx) => (
                  <div key={idx} className="sc-pricing-oracle__tenor">
                    <span className="sc-pricing-oracle__tenor-label">
                      {point.tenor_months}M
                    </span>
                    <div className="sc-pricing-oracle__bar-container">
                      <div
                        className="sc-pricing-oracle__confidence-range"
                        style={{
                          left: `${barPercent(point.price_usd - point.confidence_interval, maxPrice)}%`,
                          width: `${barPercent(point.confidence_interval * 2, maxPrice)}%`,
                          backgroundColor: theme.tokens['--es-color-primary'],
                          opacity: 0.2,
                        }}
                      />
                      <div
                        className="sc-pricing-oracle__price-bar"
                        style={{
                          width: `${barPercent(point.price_usd, maxPrice)}%`,
                          backgroundColor: theme.tokens['--es-color-primary'],
                        }}
                      />
                    </div>
                    <span className="sc-pricing-oracle__price-label">
                      ${point.price_usd.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="sc-pricing-oracle__table">
                <div className="sc-pricing-oracle__table-header">
                  <span className="sc-pricing-oracle__col-tenor">Tenor</span>
                  <span className="sc-pricing-oracle__col-price">Price</span>
                  <span className="sc-pricing-oracle__col-ci">CI (\u00B1)</span>
                  <span className="sc-pricing-oracle__col-premium">vs Spot</span>
                </div>
                {curve.curve.map((point, idx) => (
                  <div key={idx} className="sc-pricing-oracle__table-row">
                    <span className="sc-pricing-oracle__tenor-cell">
                      {point.tenor_months}M
                    </span>
                    <span className="sc-pricing-oracle__price-cell">
                      ${point.price_usd.toFixed(2)}
                    </span>
                    <span className="sc-pricing-oracle__ci-cell">
                      \u00B1${point.confidence_interval.toFixed(2)}
                    </span>
                    <span
                      className="sc-pricing-oracle__premium-cell"
                      style={{
                        color: premiumColor(point, curve.spot_price_usd, theme),
                      }}
                    >
                      {premiumText(point, curve.spot_price_usd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sc-pricing-oracle__meta">
              <span className="sc-pricing-oracle__generated">
                Updated: {new Date(curve.generated_at).toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          <div className="sc-pricing-oracle__empty">No forward curve data available</div>
        )}
      </div>
    </WidgetFrame>
  );
}

function barPercent(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function premiumText(point: ForwardPricePoint, spotPrice: number): string {
  if (spotPrice === 0) return '\u2014';
  const pct = ((point.price_usd - spotPrice) / spotPrice) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function premiumColor(
  point: ForwardPricePoint,
  spotPrice: number,
  theme: ReturnType<typeof useEStreamTheme>,
): string {
  const diff = point.price_usd - spotPrice;
  if (diff > 0) return theme.tokens['--es-color-error'] ?? '#ef4444';
  if (diff < 0) return theme.tokens['--es-color-success'] ?? '#22c55e';
  return theme.tokens['--es-color-muted'] ?? '#6b7280';
}

PricingOracleWidget.manifest = PRICING_ORACLE_MANIFEST;
