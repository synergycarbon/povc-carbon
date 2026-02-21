/**
 * Forward Pricing Oracle
 *
 * Generates forward price curves for carbon credits by combining cost-of-carry,
 * AI supply adjustment from yield forecasts, market sentiment signals, and
 * methodology premiums. Publishes curves to lex topics:
 *   - sc.ai.pricing.spot (real-time)
 *   - sc.ai.pricing.forward.near (hourly)
 *   - sc.ai.pricing.forward.term (daily)
 *
 * @circuit price_forward — generates list<PricePoint> for a credit type/registry
 * @stream price_updates — event<PricePoint> with 5y retention
 */

import {
  compute_forward_price,
  compute_carry_breakdown,
  type CostOfCarryConfig,
  DEFAULT_CARRY_CONFIG,
} from './cost_of_carry';
import {
  build_full_curve,
  smooth_curve,
  curve_slope,
  STANDARD_TENORS,
  type CurvePoint,
  type InterpolatedCurve,
} from './curve';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OracleConfig {
  carry: CostOfCarryConfig;
  supply_elasticity: number;
  vintage_decay_per_year: number;
  update_interval_s: number;
  basis_alert_sigma: number;
  methodology_premiums: Map<string, number>;
}

export const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  carry: DEFAULT_CARRY_CONFIG,
  supply_elasticity: 0.3,
  vintage_decay_per_year: 0.02,
  update_interval_s: 60,
  basis_alert_sigma: 2.0,
  methodology_premiums: new Map([
    ['EPA-AP42-CH4-FLARE', 1.0],
    ['IPCC-AR5-100Y', 1.05],
    ['VCS-AMS-III-H', 0.98],
    ['GS-MICRO-SCALE', 1.10],
  ]),
};

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface SpotPrice {
  price_per_tonne_usd: number;
  volume_24h_tco2e: number;
  bid_ask_spread_usd: number;
  timestamp: number;
}

export interface YieldForecastInput {
  tenant_id: string;
  horizons: Array<{
    horizon_days: number;
    projected_tco2e: number;
    confidence_80_lo: number;
    confidence_80_hi: number;
  }>;
  forecast_time: number;
}

export interface HistoricalYield {
  avg_daily_tco2e_30d: number;
  avg_daily_tco2e_90d: number;
  avg_daily_tco2e_365d: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface ForwardCurveOutput {
  spot_price_usd: number;
  methodology_id: string;
  current_vintage_year: number;
  tenors: TenorPrice[];
  generated_at: number;
  model_version: string;
}

export interface TenorPrice {
  tenor: string;
  tenor_days: number;
  forward_price_usd: number;
  carry_cost_usd: number;
  supply_adjustment_usd: number;
  methodology_premium: number;
  confidence_lo: number;
  confidence_hi: number;
}

export interface BasisAlert {
  tenor: string;
  tenor_days: number;
  expected_price: number;
  observed_price: number;
  sigma_deviation: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Forward Pricing Oracle
// ---------------------------------------------------------------------------

export class ForwardPricingOracle {
  private config: OracleConfig;
  private price_history: SpotPrice[] = [];
  private last_curve: ForwardCurveOutput | null = null;
  private price_std_devs: Map<number, number> = new Map();

  constructor(config: Partial<OracleConfig> = {}) {
    this.config = {
      ...DEFAULT_ORACLE_CONFIG,
      ...config,
      carry: { ...DEFAULT_CARRY_CONFIG, ...config.carry },
    };
  }

  generate_curve(
    spot: SpotPrice,
    yield_forecast: YieldForecastInput | null,
    historical: HistoricalYield | null,
    methodology_id: string = 'EPA-AP42-CH4-FLARE',
    vintage_year: number = new Date().getFullYear(),
  ): ForwardCurveOutput {
    this.ingest_spot(spot);
    const premium = this.config.methodology_premiums.get(methodology_id) ?? 1.0;

    const tenors: TenorPrice[] = [];

    for (const std_tenor of STANDARD_TENORS) {
      const base_forward = compute_forward_price(
        spot.price_per_tonne_usd,
        std_tenor.days,
        this.config.carry,
      );

      const carry = compute_carry_breakdown(
        spot.price_per_tonne_usd,
        std_tenor.days,
        this.config.carry,
      );

      const supply_adj = yield_forecast && historical
        ? this.compute_supply_adjustment(spot.price_per_tonne_usd, std_tenor.days, yield_forecast, historical)
        : 0;

      const vintage_adj = this.compute_vintage_decay(spot.price_per_tonne_usd, std_tenor.days, vintage_year);
      const forward = (base_forward + supply_adj - vintage_adj) * premium;

      const ci_pct = 0.02 * Math.sqrt(std_tenor.days / 30);
      const confidence_lo = forward * (1 - ci_pct);
      const confidence_hi = forward * (1 + ci_pct);

      tenors.push({
        tenor: std_tenor.label,
        tenor_days: std_tenor.days,
        forward_price_usd: round_price(forward),
        carry_cost_usd: round_price(carry.net_carry_cost),
        supply_adjustment_usd: round_price(supply_adj),
        methodology_premium: premium,
        confidence_lo: round_price(confidence_lo),
        confidence_hi: round_price(confidence_hi),
      });
    }

    const output: ForwardCurveOutput = {
      spot_price_usd: spot.price_per_tonne_usd,
      methodology_id,
      current_vintage_year: vintage_year,
      tenors,
      generated_at: spot.timestamp,
      model_version: 'sc.ai.forward_pricing_oracle.v1',
    };

    this.last_curve = output;
    return output;
  }

  check_basis_alerts(
    current_curve: ForwardCurveOutput,
    observed_prices: Map<number, number>,
  ): BasisAlert[] {
    const alerts: BasisAlert[] = [];

    for (const tenor of current_curve.tenors) {
      const observed = observed_prices.get(tenor.tenor_days);
      if (observed === undefined) continue;

      const std_dev = this.price_std_devs.get(tenor.tenor_days) ?? (tenor.forward_price_usd * 0.05);
      if (std_dev === 0) continue;

      const deviation = Math.abs(observed - tenor.forward_price_usd) / std_dev;

      if (deviation >= this.config.basis_alert_sigma) {
        alerts.push({
          tenor: tenor.tenor,
          tenor_days: tenor.tenor_days,
          expected_price: tenor.forward_price_usd,
          observed_price: observed,
          sigma_deviation: round_price(deviation),
          timestamp: current_curve.generated_at,
        });
      }
    }

    return alerts;
  }

  get_interpolated_curve(timestamp: number): InterpolatedCurve | null {
    if (!this.last_curve) return null;

    const points: CurvePoint[] = this.last_curve.tenors.map(t => ({
      tenor_days: t.tenor_days,
      price_usd: t.forward_price_usd,
      confidence_lo: t.confidence_lo,
      confidence_hi: t.confidence_hi,
    }));

    const raw = build_full_curve(points, this.last_curve.spot_price_usd, timestamp);
    return {
      ...raw,
      points: smooth_curve(raw.points),
    };
  }

  private compute_supply_adjustment(
    spot_price: number,
    tenor_days: number,
    forecast: YieldForecastInput,
    historical: HistoricalYield,
  ): number {
    const horizon = forecast.horizons.find(h => h.horizon_days >= tenor_days)
      ?? forecast.horizons[forecast.horizons.length - 1];

    if (!horizon) return 0;

    const historical_daily = tenor_days <= 30
      ? historical.avg_daily_tco2e_30d
      : tenor_days <= 90
        ? historical.avg_daily_tco2e_90d
        : historical.avg_daily_tco2e_365d;

    const forecast_daily = horizon.projected_tco2e / horizon.horizon_days;

    if (historical_daily <= 0) return 0;

    const supply_ratio = forecast_daily / historical_daily;
    const scarcity = Math.max(0, 1 - supply_ratio);

    return spot_price * scarcity * this.config.supply_elasticity;
  }

  private compute_vintage_decay(
    spot_price: number,
    tenor_days: number,
    vintage_year: number,
  ): number {
    const current_year = new Date().getFullYear();
    const age_years = current_year - vintage_year;
    if (age_years <= 0) return 0;
    return spot_price * this.config.vintage_decay_per_year * age_years;
  }

  private ingest_spot(spot: SpotPrice): void {
    this.price_history.push(spot);
    if (this.price_history.length > 1_000) {
      this.price_history.shift();
    }

    if (this.price_history.length >= 20) {
      this.update_std_devs();
    }
  }

  private update_std_devs(): void {
    const prices = this.price_history.map(p => p.price_per_tonne_usd);
    const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
    const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
    const std = Math.sqrt(variance);

    for (const tenor of STANDARD_TENORS) {
      const tenor_factor = Math.sqrt(tenor.days / 30);
      this.price_std_devs.set(tenor.days, std * tenor_factor);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round_price(value: number): number {
  return Math.round(value * 100) / 100;
}
