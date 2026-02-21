/**
 * Rolling Accuracy Metrics
 *
 * Tracks MAE, MAPE, and R² for yield predictions across horizons.
 * Maintains a rolling window of (predicted, actual) pairs for each
 * horizon and computes accuracy metrics on demand.
 *
 * @circuit evaluate_accuracy — feeds actual vs predicted for scoring
 */

import type { HorizonCode } from './model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccuracyRecord {
  horizon: HorizonCode;
  predicted: number;
  actual: number;
  timestamp: number;
}

export interface HorizonAccuracy {
  horizon: HorizonCode;
  mae: number;
  mape: number;
  r_squared: number;
  sample_count: number;
}

export interface AccuracySnapshot {
  horizons: HorizonAccuracy[];
  overall_mae: number;
  overall_mape: number;
  overall_r_squared: number;
  total_samples: number;
  window_start: number;
  window_end: number;
}

// ---------------------------------------------------------------------------
// Rolling Accuracy Tracker
// ---------------------------------------------------------------------------

export class RollingAccuracy {
  private records: AccuracyRecord[] = [];
  private max_records: number;

  constructor(max_records: number = 8_760) {
    this.max_records = max_records;
  }

  record(
    horizon: HorizonCode,
    predicted: number,
    actual: number,
    timestamp: number,
  ): void {
    this.records.push({ horizon, predicted, actual, timestamp });

    if (this.records.length > this.max_records) {
      this.records.shift();
    }
  }

  snapshot(): AccuracySnapshot {
    if (this.records.length === 0) {
      return {
        horizons: [],
        overall_mae: 0,
        overall_mape: 0,
        overall_r_squared: 0,
        total_samples: 0,
        window_start: 0,
        window_end: 0,
      };
    }

    const by_horizon = new Map<HorizonCode, AccuracyRecord[]>();
    for (const rec of this.records) {
      const arr = by_horizon.get(rec.horizon) ?? [];
      arr.push(rec);
      by_horizon.set(rec.horizon, arr);
    }

    const horizons: HorizonAccuracy[] = [];
    for (const [horizon, recs] of by_horizon) {
      horizons.push(compute_horizon_accuracy(horizon, recs));
    }

    const overall = compute_overall(this.records);

    return {
      horizons,
      overall_mae: overall.mae,
      overall_mape: overall.mape,
      overall_r_squared: overall.r_squared,
      total_samples: this.records.length,
      window_start: this.records[0].timestamp,
      window_end: this.records[this.records.length - 1].timestamp,
    };
  }

  clear(): void {
    this.records = [];
  }
}

// ---------------------------------------------------------------------------
// Metric Computation
// ---------------------------------------------------------------------------

function compute_horizon_accuracy(
  horizon: HorizonCode,
  records: AccuracyRecord[],
): HorizonAccuracy {
  if (records.length === 0) {
    return { horizon, mae: 0, mape: 0, r_squared: 0, sample_count: 0 };
  }

  let sum_abs_error = 0;
  let sum_pct_error = 0;
  let valid_pct_count = 0;

  for (const rec of records) {
    sum_abs_error += Math.abs(rec.predicted - rec.actual);
    if (rec.actual !== 0) {
      sum_pct_error += Math.abs((rec.predicted - rec.actual) / rec.actual);
      valid_pct_count++;
    }
  }

  const mae = sum_abs_error / records.length;
  const mape = valid_pct_count > 0 ? (sum_pct_error / valid_pct_count) * 100 : 0;
  const r_squared = compute_r_squared(records);

  return { horizon, mae, mape, r_squared, sample_count: records.length };
}

function compute_overall(records: AccuracyRecord[]): { mae: number; mape: number; r_squared: number } {
  if (records.length === 0) return { mae: 0, mape: 0, r_squared: 0 };

  let sum_abs_error = 0;
  let sum_pct_error = 0;
  let valid_pct_count = 0;

  for (const rec of records) {
    sum_abs_error += Math.abs(rec.predicted - rec.actual);
    if (rec.actual !== 0) {
      sum_pct_error += Math.abs((rec.predicted - rec.actual) / rec.actual);
      valid_pct_count++;
    }
  }

  return {
    mae: sum_abs_error / records.length,
    mape: valid_pct_count > 0 ? (sum_pct_error / valid_pct_count) * 100 : 0,
    r_squared: compute_r_squared(records),
  };
}

function compute_r_squared(records: AccuracyRecord[]): number {
  if (records.length < 2) return 0;

  const mean_actual = records.reduce((s, r) => s + r.actual, 0) / records.length;

  let ss_res = 0;
  let ss_tot = 0;
  for (const rec of records) {
    ss_res += (rec.actual - rec.predicted) ** 2;
    ss_tot += (rec.actual - mean_actual) ** 2;
  }

  if (ss_tot === 0) return 1;
  return Math.max(0, 1 - ss_res / ss_tot);
}
