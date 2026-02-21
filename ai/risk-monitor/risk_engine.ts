/**
 * Multi-Factor Risk Scoring Engine
 *
 * Monitors counterparty risk, delivery risk, market risk, and methodology risk.
 * Produces per-contract, per-project, and portfolio-level risk scores on a 0–100
 * scale. Integrates with StreamSight for real-time observability.
 *
 * @circuit assess_risk — computes RiskMetric for a target
 * @circuit portfolio_risk — aggregates risk across a portfolio of sources
 * @stream risk_alerts — event<RiskMetric> with 5y retention
 */

// ---------------------------------------------------------------------------
// Risk Type Constants
// ---------------------------------------------------------------------------

export const RISK_TYPE = {
  COUNTERPARTY: 0,
  DELIVERY: 1,
  MARKET: 2,
  METHODOLOGY: 3,
} as const;

export type RiskType = (typeof RISK_TYPE)[keyof typeof RISK_TYPE];

export const SEVERITY = {
  LOW: 0,
  MODERATE: 1,
  ELEVATED: 2,
  CRITICAL: 3,
} as const;

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

// ---------------------------------------------------------------------------
// Risk Score Thresholds
// ---------------------------------------------------------------------------

export interface RiskThresholds {
  low_max: number;
  moderate_max: number;
  elevated_max: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  low_max: 25,
  moderate_max: 50,
  elevated_max: 75,
};

// ---------------------------------------------------------------------------
// Risk Input Types
// ---------------------------------------------------------------------------

export interface CounterpartyIndicators {
  payment_history_score: number;
  contract_completion_rate: number;
  spark_reputation_score: number;
  days_since_last_default: number;
  outstanding_volume_tco2e: number;
}

export interface DeliveryIndicators {
  forecast_tco2e: number;
  committed_tco2e: number;
  site_health_score: number;
  weather_outlook_score: number;
  historical_delivery_rate: number;
}

export interface MarketIndicators {
  price_volatility_30d: number;
  bid_ask_spread_pct: number;
  order_book_depth_usd: number;
  volume_trend: number;
  correlation_to_benchmark: number;
}

export interface MethodologyIndicators {
  governance_proposal_count: number;
  compliance_flag_density: number;
  registry_status_score: number;
  methodology_age_years: number;
  peer_review_score: number;
}

// ---------------------------------------------------------------------------
// Risk Output Types
// ---------------------------------------------------------------------------

export interface RiskScore {
  risk_type: RiskType;
  score: number;
  severity: Severity;
  indicators: Record<string, number>;
  mitigation_suggestions: string[];
  assessed_at: number;
}

export interface CompositeRiskScore {
  target_id: string;
  target_type: 'contract' | 'project' | 'portfolio';
  dimensions: RiskScore[];
  composite_score: number;
  composite_severity: Severity;
  assessed_at: number;
}

export interface PortfolioRisk {
  source_count: number;
  avg_risk: number;
  max_risk: number;
  weighted_risk: number;
  risk_distribution: Record<string, number>;
  high_risk_sources: string[];
}

// ---------------------------------------------------------------------------
// Risk Configuration
// ---------------------------------------------------------------------------

export interface RiskWeights {
  counterparty: number;
  delivery: number;
  market: number;
  methodology: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = {
  counterparty: 0.30,
  delivery: 0.30,
  market: 0.25,
  methodology: 0.15,
};

// ---------------------------------------------------------------------------
// Risk Engine
// ---------------------------------------------------------------------------

export class RiskEngine {
  private thresholds: RiskThresholds;
  private weights: RiskWeights;

  constructor(
    thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
    weights: RiskWeights = DEFAULT_WEIGHTS,
  ) {
    this.thresholds = thresholds;
    this.weights = weights;
  }

  assess_counterparty(indicators: CounterpartyIndicators, timestamp: number): RiskScore {
    const scores: Record<string, number> = {};

    scores.payment_history = (1 - indicators.payment_history_score) * 100;
    scores.completion_rate = (1 - indicators.contract_completion_rate) * 100;
    scores.reputation = (1 - indicators.spark_reputation_score) * 100;
    scores.default_recency = indicators.days_since_last_default < 365
      ? Math.max(0, 80 - indicators.days_since_last_default * 0.2)
      : 0;
    scores.exposure = Math.min(100, indicators.outstanding_volume_tco2e / 1000 * 10);

    const raw = weighted_mean([
      [scores.payment_history, 0.30],
      [scores.completion_rate, 0.25],
      [scores.reputation, 0.25],
      [scores.default_recency, 0.10],
      [scores.exposure, 0.10],
    ]);

    const score = clamp_score(raw);
    return {
      risk_type: RISK_TYPE.COUNTERPARTY,
      score,
      severity: this.severity_for(score),
      indicators: scores,
      mitigation_suggestions: this.counterparty_mitigations(score, indicators),
      assessed_at: timestamp,
    };
  }

  assess_delivery(indicators: DeliveryIndicators, timestamp: number): RiskScore {
    const scores: Record<string, number> = {};

    const coverage = indicators.committed_tco2e > 0
      ? indicators.forecast_tco2e / indicators.committed_tco2e
      : 1;
    scores.coverage_gap = Math.max(0, (1 - coverage) * 150);
    scores.site_health = (1 - indicators.site_health_score) * 100;
    scores.weather = (1 - indicators.weather_outlook_score) * 100;
    scores.delivery_history = (1 - indicators.historical_delivery_rate) * 100;

    const raw = weighted_mean([
      [scores.coverage_gap, 0.40],
      [scores.site_health, 0.25],
      [scores.weather, 0.15],
      [scores.delivery_history, 0.20],
    ]);

    const score = clamp_score(raw);
    return {
      risk_type: RISK_TYPE.DELIVERY,
      score,
      severity: this.severity_for(score),
      indicators: scores,
      mitigation_suggestions: this.delivery_mitigations(score, indicators),
      assessed_at: timestamp,
    };
  }

  assess_market(indicators: MarketIndicators, timestamp: number): RiskScore {
    const scores: Record<string, number> = {};

    scores.volatility = Math.min(100, indicators.price_volatility_30d * 200);
    scores.spread = Math.min(100, indicators.bid_ask_spread_pct * 20);
    scores.liquidity = Math.max(0, 100 - Math.min(100, indicators.order_book_depth_usd / 10_000 * 100));
    scores.volume_trend = indicators.volume_trend < 0
      ? Math.min(100, Math.abs(indicators.volume_trend) * 100)
      : 0;

    const raw = weighted_mean([
      [scores.volatility, 0.35],
      [scores.spread, 0.25],
      [scores.liquidity, 0.25],
      [scores.volume_trend, 0.15],
    ]);

    const score = clamp_score(raw);
    return {
      risk_type: RISK_TYPE.MARKET,
      score,
      severity: this.severity_for(score),
      indicators: scores,
      mitigation_suggestions: this.market_mitigations(score),
      assessed_at: timestamp,
    };
  }

  assess_methodology(indicators: MethodologyIndicators, timestamp: number): RiskScore {
    const scores: Record<string, number> = {};

    scores.governance_activity = Math.min(100, indicators.governance_proposal_count * 15);
    scores.compliance_flags = Math.min(100, indicators.compliance_flag_density * 100);
    scores.registry_status = (1 - indicators.registry_status_score) * 100;
    scores.methodology_maturity = indicators.methodology_age_years < 2 ? 40 : 0;
    scores.peer_review = (1 - indicators.peer_review_score) * 100;

    const raw = weighted_mean([
      [scores.governance_activity, 0.25],
      [scores.compliance_flags, 0.25],
      [scores.registry_status, 0.20],
      [scores.methodology_maturity, 0.15],
      [scores.peer_review, 0.15],
    ]);

    const score = clamp_score(raw);
    return {
      risk_type: RISK_TYPE.METHODOLOGY,
      score,
      severity: this.severity_for(score),
      indicators: scores,
      mitigation_suggestions: this.methodology_mitigations(score),
      assessed_at: timestamp,
    };
  }

  compute_composite(
    target_id: string,
    target_type: 'contract' | 'project' | 'portfolio',
    dimensions: RiskScore[],
    timestamp: number,
  ): CompositeRiskScore {
    const weight_map: Record<number, number> = {
      [RISK_TYPE.COUNTERPARTY]: this.weights.counterparty,
      [RISK_TYPE.DELIVERY]: this.weights.delivery,
      [RISK_TYPE.MARKET]: this.weights.market,
      [RISK_TYPE.METHODOLOGY]: this.weights.methodology,
    };

    let weighted_sum = 0;
    let weight_total = 0;

    for (const dim of dimensions) {
      const w = weight_map[dim.risk_type] ?? 0.25;
      weighted_sum += dim.score * w;
      weight_total += w;
    }

    const composite_score = weight_total > 0 ? clamp_score(weighted_sum / weight_total) : 0;

    return {
      target_id,
      target_type,
      dimensions,
      composite_score,
      composite_severity: this.severity_for(composite_score),
      assessed_at: timestamp,
    };
  }

  compute_portfolio_risk(
    sources: Array<{ source_id: string; score: number; weight: number }>,
  ): PortfolioRisk {
    if (sources.length === 0) {
      return {
        source_count: 0,
        avg_risk: 0,
        max_risk: 0,
        weighted_risk: 0,
        risk_distribution: { low: 0, moderate: 0, elevated: 0, critical: 0 },
        high_risk_sources: [],
      };
    }

    const scores = sources.map(s => s.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);

    let weighted_sum = 0;
    let weight_total = 0;
    for (const s of sources) {
      weighted_sum += s.score * s.weight;
      weight_total += s.weight;
    }
    const weighted = weight_total > 0 ? weighted_sum / weight_total : 0;

    const dist = { low: 0, moderate: 0, elevated: 0, critical: 0 };
    const high_risk: string[] = [];

    for (const s of sources) {
      const sev = this.severity_for(s.score);
      if (sev === SEVERITY.LOW) dist.low++;
      else if (sev === SEVERITY.MODERATE) dist.moderate++;
      else if (sev === SEVERITY.ELEVATED) dist.elevated++;
      else { dist.critical++; high_risk.push(s.source_id); }

      if (sev >= SEVERITY.ELEVATED) high_risk.push(s.source_id);
    }

    return {
      source_count: sources.length,
      avg_risk: Math.round(avg * 100) / 100,
      max_risk: max,
      weighted_risk: Math.round(weighted * 100) / 100,
      risk_distribution: dist,
      high_risk_sources: [...new Set(high_risk)],
    };
  }

  severity_for(score: number): Severity {
    if (score <= this.thresholds.low_max) return SEVERITY.LOW;
    if (score <= this.thresholds.moderate_max) return SEVERITY.MODERATE;
    if (score <= this.thresholds.elevated_max) return SEVERITY.ELEVATED;
    return SEVERITY.CRITICAL;
  }

  // ── Mitigation Suggestion Generators ───────────────────────────────

  private counterparty_mitigations(score: number, ind: CounterpartyIndicators): string[] {
    const m: string[] = [];
    if (score > 75) m.push('Pause new commitments with this counterparty');
    if (score > 50) m.push('Require collateral or letter of credit');
    if (ind.contract_completion_rate < 0.8) m.push('Reduce position size');
    if (ind.spark_reputation_score < 0.5) m.push('Request enhanced KYC verification');
    return m;
  }

  private delivery_mitigations(score: number, ind: DeliveryIndicators): string[] {
    const m: string[] = [];
    if (score > 75) m.push('Activate backup supply sources');
    if (ind.forecast_tco2e < ind.committed_tco2e) m.push('Reduce forward commitment volume');
    if (ind.site_health_score < 0.5) m.push('Schedule site maintenance inspection');
    if (ind.weather_outlook_score < 0.3) m.push('Hedge weather-dependent delivery risk');
    return m;
  }

  private market_mitigations(score: number): string[] {
    const m: string[] = [];
    if (score > 75) m.push('Reduce market exposure via hedging');
    if (score > 50) m.push('Widen bid-ask spreads on new listings');
    if (score > 25) m.push('Monitor volatility triggers more frequently');
    return m;
  }

  private methodology_mitigations(score: number): string[] {
    const m: string[] = [];
    if (score > 75) m.push('Escalate to governance committee for review');
    if (score > 50) m.push('Diversify methodology exposure');
    if (score > 25) m.push('Track governance proposals affecting this methodology');
    return m;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weighted_mean(pairs: [number, number][]): number {
  let sum = 0;
  let weight_total = 0;
  for (const [value, weight] of pairs) {
    sum += value * weight;
    weight_total += weight;
  }
  return weight_total > 0 ? sum / weight_total : 0;
}

function clamp_score(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}
