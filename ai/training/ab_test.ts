/**
 * A/B Testing Framework for Model Updates
 *
 * Routes inference requests between control (current production) and
 * treatment (candidate) models based on configurable traffic splits.
 * Collects accuracy metrics for both arms and provides statistical
 * significance testing to determine promotion eligibility.
 */

import type { ModelCheckpoint } from '../yield-forecaster/model';
import type { HorizonPrediction } from '../yield-forecaster/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABTestConfig {
  test_id: string;
  control_version: string;
  treatment_version: string;
  traffic_split_pct: number;
  min_samples: number;
  max_duration_s: number;
  significance_level: number;
}

export type ABTestStatus = 'running' | 'completed' | 'cancelled' | 'inconclusive';
export type ABTestDecision = 'promote_treatment' | 'retain_control' | 'inconclusive' | 'pending';

export interface ABTestArm {
  version: string;
  samples: number;
  total_error: number;
  total_squared_error: number;
  predictions: Array<{
    predicted: number;
    actual: number;
    timestamp: number;
  }>;
}

export interface ABTestResult {
  test_id: string;
  status: ABTestStatus;
  decision: ABTestDecision;
  control: ABTestArmSummary;
  treatment: ABTestArmSummary;
  p_value: number | null;
  duration_s: number;
  started_at: number;
  ended_at: number | null;
}

export interface ABTestArmSummary {
  version: string;
  samples: number;
  mae: number;
  mse: number;
  mape: number;
}

// ---------------------------------------------------------------------------
// A/B Test Runner
// ---------------------------------------------------------------------------

export class ABTestRunner {
  private config: ABTestConfig;
  private control: ABTestArm;
  private treatment: ABTestArm;
  private started_at: number;
  private status: ABTestStatus = 'running';

  constructor(config: ABTestConfig) {
    this.config = config;
    this.started_at = Math.floor(Date.now() / 1000);
    this.control = create_arm(config.control_version);
    this.treatment = create_arm(config.treatment_version);
  }

  route_request(): 'control' | 'treatment' {
    if (this.status !== 'running') return 'control';
    return Math.random() * 100 < this.config.traffic_split_pct ? 'treatment' : 'control';
  }

  record_control(predicted: number, actual: number, timestamp: number): void {
    record_observation(this.control, predicted, actual, timestamp);
    this.check_completion(timestamp);
  }

  record_treatment(predicted: number, actual: number, timestamp: number): void {
    record_observation(this.treatment, predicted, actual, timestamp);
    this.check_completion(timestamp);
  }

  get_result(): ABTestResult {
    const now = Math.floor(Date.now() / 1000);
    const control_summary = summarize_arm(this.control);
    const treatment_summary = summarize_arm(this.treatment);

    let p_value: number | null = null;
    let decision: ABTestDecision = 'pending';

    if (this.control.samples >= 30 && this.treatment.samples >= 30) {
      p_value = welch_t_test(this.control, this.treatment);
      decision = determine_decision(
        control_summary,
        treatment_summary,
        p_value,
        this.config.significance_level,
      );
    }

    return {
      test_id: this.config.test_id,
      status: this.status,
      decision,
      control: control_summary,
      treatment: treatment_summary,
      p_value,
      duration_s: now - this.started_at,
      started_at: this.started_at,
      ended_at: this.status !== 'running' ? now : null,
    };
  }

  cancel(): void {
    this.status = 'cancelled';
  }

  get is_running(): boolean {
    return this.status === 'running';
  }

  private check_completion(timestamp: number): void {
    if (this.status !== 'running') return;

    const duration = timestamp - this.started_at;
    if (duration >= this.config.max_duration_s) {
      this.status = 'completed';
      return;
    }

    if (this.control.samples >= this.config.min_samples
      && this.treatment.samples >= this.config.min_samples) {
      this.status = 'completed';
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function create_arm(version: string): ABTestArm {
  return {
    version,
    samples: 0,
    total_error: 0,
    total_squared_error: 0,
    predictions: [],
  };
}

function record_observation(
  arm: ABTestArm,
  predicted: number,
  actual: number,
  timestamp: number,
): void {
  const error = Math.abs(predicted - actual);
  arm.samples++;
  arm.total_error += error;
  arm.total_squared_error += error * error;
  arm.predictions.push({ predicted, actual, timestamp });
}

function summarize_arm(arm: ABTestArm): ABTestArmSummary {
  if (arm.samples === 0) {
    return { version: arm.version, samples: 0, mae: 0, mse: 0, mape: 0 };
  }

  const mae = arm.total_error / arm.samples;
  const mse = arm.total_squared_error / arm.samples;

  let mape_sum = 0;
  let mape_count = 0;
  for (const p of arm.predictions) {
    if (p.actual !== 0) {
      mape_sum += Math.abs((p.predicted - p.actual) / p.actual);
      mape_count++;
    }
  }
  const mape = mape_count > 0 ? (mape_sum / mape_count) * 100 : 0;

  return { version: arm.version, samples: arm.samples, mae, mse, mape };
}

/**
 * Welch's t-test for unequal variances.
 * Returns approximate p-value for the hypothesis that treatment MAE < control MAE.
 */
function welch_t_test(control: ABTestArm, treatment: ABTestArm): number {
  if (control.samples < 2 || treatment.samples < 2) return 1;

  const c_errors = control.predictions.map(p => Math.abs(p.predicted - p.actual));
  const t_errors = treatment.predictions.map(p => Math.abs(p.predicted - p.actual));

  const c_mean = c_errors.reduce((s, v) => s + v, 0) / c_errors.length;
  const t_mean = t_errors.reduce((s, v) => s + v, 0) / t_errors.length;

  const c_var = c_errors.reduce((s, v) => s + (v - c_mean) ** 2, 0) / (c_errors.length - 1);
  const t_var = t_errors.reduce((s, v) => s + (v - t_mean) ** 2, 0) / (t_errors.length - 1);

  const se = Math.sqrt(c_var / c_errors.length + t_var / t_errors.length);
  if (se === 0) return c_mean === t_mean ? 0.5 : 0;

  const t_stat = (c_mean - t_mean) / se;

  // Approximate p-value using normal CDF for large samples
  return 1 - normal_cdf(t_stat);
}

function normal_cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const abs_x = Math.abs(x) / Math.SQRT2;

  const t = 1 / (1 + p * abs_x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs_x * abs_x);

  return 0.5 * (1 + sign * y);
}

function determine_decision(
  control: ABTestArmSummary,
  treatment: ABTestArmSummary,
  p_value: number,
  significance: number,
): ABTestDecision {
  if (p_value > significance) return 'inconclusive';
  return treatment.mae < control.mae ? 'promote_treatment' : 'retain_control';
}
