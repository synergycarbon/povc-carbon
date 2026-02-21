/**
 * Yield Forecasting Engine
 *
 * Orchestrates Mamba/S4 SSM inference for multi-horizon carbon yield prediction.
 * Manages model lifecycle, feature ingestion, confidence interval computation,
 * and deviation alerting. Publishes forecasts to lex topic
 * `sc.ai.forecasts.yield.{tenant}.{project}`.
 *
 * @circuit forecast_yield — generates YieldCurve for a given source and horizon
 * @stream yield_predictions — event<YieldCurve> with 5y retention
 */

import {
  MambaS4Model,
  HORIZON,
  HORIZON_DAYS,
  DEFAULT_MAMBA_CONFIG,
  type ModelCheckpoint,
  type HorizonPrediction,
  type InferenceResult,
  type HorizonCode,
} from './model';
import {
  extract_features,
  ewma_smooth,
  FEATURE_COUNT,
  type FeatureExtractionInput,
} from './features';
import { RollingAccuracy, type AccuracySnapshot } from './accuracy';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ForecasterConfig {
  inference_interval_s: number;
  ewma_alpha: number;
  baseline_window_days: number;
  deviation_alert_pct: number;
  deviation_alert_hours: number;
  confidence_levels: number[];
  rlhf_operator_weight_max: number;
  max_feature_history: number;
}

export const DEFAULT_FORECASTER_CONFIG: ForecasterConfig = {
  inference_interval_s: 3_600,
  ewma_alpha: 0.1,
  baseline_window_days: 30,
  deviation_alert_pct: 20.0,
  deviation_alert_hours: 48,
  confidence_levels: [0.80, 0.95],
  rlhf_operator_weight_max: 2.0,
  max_feature_history: 8_760,
};

// ---------------------------------------------------------------------------
// Forecast Output
// ---------------------------------------------------------------------------

export interface YieldForecast {
  tenant_id: string;
  project_id: string;
  horizons: HorizonPrediction[];
  generated_at: number;
  model_version: string;
  model_id: Uint8Array;
  corpus_hash: Uint8Array;
  staleness_hours: number;
}

export interface CapacityForecast {
  current_capacity_factor: number;
  projected_7d: number;
  projected_30d: number;
  projected_90d: number;
  nameplate_kw: number;
}

export interface DeviationAlert {
  tenant_id: string;
  project_id: string;
  forecast_tco2e_day: number;
  actual_tco2e_day: number;
  deviation_pct: number;
  severity: number;
  possible_causes: string[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Forecaster Engine
// ---------------------------------------------------------------------------

export class YieldForecaster {
  private model: MambaS4Model;
  private config: ForecasterConfig;
  private feature_history: Float64Array[] = [];
  private accuracy: RollingAccuracy;
  private last_inference_at = 0;
  private baseline_daily_tco2e = 0;
  private consecutive_deviation_hours = 0;

  constructor(
    checkpoint: ModelCheckpoint,
    config: Partial<ForecasterConfig> = {},
  ) {
    this.model = new MambaS4Model(checkpoint);
    this.config = { ...DEFAULT_FORECASTER_CONFIG, ...config };
    this.accuracy = new RollingAccuracy(this.config.baseline_window_days * 24);
  }

  async forecast(
    tenant_id: string,
    project_id: string,
    input: FeatureExtractionInput,
    horizons: HorizonCode[] = [HORIZON.H_24H, HORIZON.H_7D, HORIZON.H_30D, HORIZON.H_90D, HORIZON.H_1Y],
  ): Promise<YieldForecast> {
    const features = extract_features(input);
    this.ingest_features(features);

    const smoothed = ewma_smooth(this.feature_history, this.config.ewma_alpha);

    const result = await this.model.infer({
      model_id: this.model.model_id,
      source_id: new Uint8Array(16),
      feature_vector: smoothed,
      horizons,
      timestamp: input.calendar.timestamp,
    });

    this.last_inference_at = input.calendar.timestamp;

    return {
      tenant_id,
      project_id,
      horizons: result.predictions,
      generated_at: result.generated_at,
      model_version: result.model_version,
      model_id: result.model_id,
      corpus_hash: result.corpus_hash,
      staleness_hours: result.staleness_hours,
    };
  }

  compute_capacity_forecast(
    current_capacity_factor: number,
    nameplate_kw: number,
    forecast: YieldForecast,
  ): CapacityForecast {
    const degradation_per_day = 0.0001;

    return {
      current_capacity_factor,
      projected_7d: Math.max(0, current_capacity_factor - degradation_per_day * 7),
      projected_30d: Math.max(0, current_capacity_factor - degradation_per_day * 30),
      projected_90d: Math.max(0, current_capacity_factor - degradation_per_day * 90),
      nameplate_kw,
    };
  }

  check_deviation(
    forecast_daily_tco2e: number,
    actual_daily_tco2e: number,
    tenant_id: string,
    project_id: string,
    timestamp: number,
  ): DeviationAlert | null {
    if (forecast_daily_tco2e <= 0) return null;

    const deviation_pct = ((forecast_daily_tco2e - actual_daily_tco2e) / forecast_daily_tco2e) * 100;

    if (deviation_pct < this.config.deviation_alert_pct) {
      this.consecutive_deviation_hours = 0;
      return null;
    }

    this.consecutive_deviation_hours++;

    const severity = deviation_pct >= 80 ? 3
      : deviation_pct >= 50 ? 2
      : 1;

    const causes = infer_possible_causes(deviation_pct, actual_daily_tco2e);

    return {
      tenant_id,
      project_id,
      forecast_tco2e_day: forecast_daily_tco2e,
      actual_tco2e_day: actual_daily_tco2e,
      deviation_pct,
      severity,
      possible_causes: causes,
      timestamp,
    };
  }

  record_actual(
    horizon: HorizonCode,
    predicted_tco2e: number,
    actual_tco2e: number,
    timestamp: number,
  ): void {
    this.accuracy.record(horizon, predicted_tco2e, actual_tco2e, timestamp);

    if (horizon === HORIZON.H_24H) {
      this.baseline_daily_tco2e = actual_tco2e;
    }
  }

  get_accuracy(): AccuracySnapshot {
    return this.accuracy.snapshot();
  }

  get is_model_stale(): boolean {
    return this.model.is_stale;
  }

  swap_model(checkpoint: ModelCheckpoint): void {
    this.model = new MambaS4Model(checkpoint);
  }

  private ingest_features(features: Float64Array): void {
    this.feature_history.push(features);
    if (this.feature_history.length > this.config.max_feature_history) {
      this.feature_history.shift();
    }
  }
}

// ---------------------------------------------------------------------------
// Cause Inference
// ---------------------------------------------------------------------------

function infer_possible_causes(deviation_pct: number, actual: number): string[] {
  const causes: string[] = [];

  if (actual === 0) {
    causes.push('complete_shutdown');
  }
  if (deviation_pct >= 70) {
    causes.push('equipment_degradation');
  }
  if (deviation_pct >= 40) {
    causes.push('fuel_supply_reduction');
  }
  if (deviation_pct >= 20) {
    causes.push('sensor_malfunction');
    causes.push('weather_impact');
  }

  return causes;
}
