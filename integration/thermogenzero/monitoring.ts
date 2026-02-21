/**
 * ThermogenZero Pipeline Monitoring
 *
 * StreamSight integration for pipeline health metrics, latency tracking
 * (attestation received → credit minted), and error rate monitoring.
 *
 * Closes: synergycarbon/povc-carbon #69
 */

import {
  type PipelineMetrics,
  type PipelineEvent,
  type PipelineStage,
  type PipelineResult,
  type DeadLetterEntry,
} from "./pipeline";

// ---------------------------------------------------------------------------
// StreamSight Metric Types
// ---------------------------------------------------------------------------

export interface StreamSightMetric {
  namespace: string;
  name: string;
  type: "counter" | "gauge" | "histogram";
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface LatencyBucket {
  le: number;
  count: number;
}

export interface LatencyHistogram {
  buckets: LatencyBucket[];
  sum: number;
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface PipelineHealthStatus {
  healthy: boolean;
  circuit_breaker: string;
  error_rate_pct: number;
  avg_latency_ms: number;
  dead_letter_depth: number;
  alerts: AlertEvent[];
  last_check: number;
}

export interface AlertEvent {
  alert_id: string;
  name: string;
  severity: "info" | "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
  fired_at: number;
}

// ---------------------------------------------------------------------------
// Alert Thresholds
// ---------------------------------------------------------------------------

export interface AlertThresholds {
  error_rate_warning_pct: number;
  error_rate_critical_pct: number;
  latency_warning_ms: number;
  latency_critical_ms: number;
  dead_letter_warning: number;
  dead_letter_critical: number;
  stall_detection_window_ms: number;
  min_throughput_per_minute: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  error_rate_warning_pct: 5.0,
  error_rate_critical_pct: 10.0,
  latency_warning_ms: 5000,
  latency_critical_ms: 10000,
  dead_letter_warning: 10,
  dead_letter_critical: 50,
  stall_detection_window_ms: 600000,
  min_throughput_per_minute: 1,
};

// ---------------------------------------------------------------------------
// Pipeline Monitor
// ---------------------------------------------------------------------------

const NAMESPACE = "sc.bridge.thermogenzero";

const HISTOGRAM_BUCKETS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class PipelineMonitor {
  private thresholds: AlertThresholds;
  private alerts: AlertEvent[] = [];
  private alert_seq = 0;
  private emitted_metrics: StreamSightMetric[] = [];
  private last_attestation_at = 0;
  private pipeline_latencies: number[] = [];
  private stage_latencies: Map<PipelineStage, number[]> = new Map();

  constructor(thresholds?: Partial<AlertThresholds>) {
    this.thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...thresholds };
  }

  get active_alerts(): AlertEvent[] {
    return [...this.alerts];
  }

  get recent_metrics(): StreamSightMetric[] {
    return [...this.emitted_metrics];
  }

  // -----------------------------------------------------------------------
  // Record Pipeline Events
  // -----------------------------------------------------------------------

  record_result(result: PipelineResult): void {
    this.last_attestation_at = Date.now();
    this.pipeline_latencies.push(result.total_duration_ms);

    for (const event of result.stage_events) {
      const stage_list = this.stage_latencies.get(event.stage) ?? [];
      stage_list.push(event.duration_ms);
      this.stage_latencies.set(event.stage, stage_list);
    }

    this.emit_counter("attestations_received", 1, { site_id: result.site_id });

    if (result.success) {
      this.emit_counter("attestations_bridged", 1, { site_id: result.site_id });
      this.emit_histogram("pipeline_latency_ms", result.total_duration_ms, {
        site_id: result.site_id,
      });

      if (result.credit) {
        this.emit_counter("credits_minted_tco2e", result.credit.tonnes_co2e, {
          site_id: result.site_id,
          vintage_year: String(result.credit.vintage_year),
        });
      }

      if (result.retirement) {
        this.emit_counter("retirements_completed", 1, { site_id: result.site_id });
      }
    } else {
      this.emit_counter("attestations_rejected", 1, {
        site_id: result.site_id,
        rejection_reason: result.error ?? "unknown",
        stage: result.failed_stage ?? "unknown",
      });
    }

    for (const event of result.stage_events) {
      this.emit_histogram("stage_latency_ms", event.duration_ms, {
        stage: event.stage,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Health Check
  // -----------------------------------------------------------------------

  check_health(
    metrics: PipelineMetrics,
    dead_letter: DeadLetterEntry[],
    circuit_breaker_state: string,
  ): PipelineHealthStatus {
    this.alerts = [];

    const total = metrics.attestations_received;
    const error_rate = total > 0
      ? (metrics.attestations_rejected / total) * 100
      : 0;

    if (error_rate >= this.thresholds.error_rate_critical_pct) {
      this.fire_alert("high_error_rate", "critical",
        `Error rate ${error_rate.toFixed(1)}% exceeds critical threshold`,
        error_rate, this.thresholds.error_rate_critical_pct);
    } else if (error_rate >= this.thresholds.error_rate_warning_pct) {
      this.fire_alert("high_error_rate", "warning",
        `Error rate ${error_rate.toFixed(1)}% exceeds warning threshold`,
        error_rate, this.thresholds.error_rate_warning_pct);
    }

    const avg_latency = metrics.avg_pipeline_latency_ms;
    if (avg_latency >= this.thresholds.latency_critical_ms) {
      this.fire_alert("high_latency", "critical",
        `Average latency ${avg_latency.toFixed(0)}ms exceeds critical threshold`,
        avg_latency, this.thresholds.latency_critical_ms);
    } else if (avg_latency >= this.thresholds.latency_warning_ms) {
      this.fire_alert("high_latency", "warning",
        `Average latency ${avg_latency.toFixed(0)}ms exceeds warning threshold`,
        avg_latency, this.thresholds.latency_warning_ms);
    }

    const dl_depth = dead_letter.length;
    if (dl_depth >= this.thresholds.dead_letter_critical) {
      this.fire_alert("dead_letter_depth", "critical",
        `Dead letter queue depth ${dl_depth} exceeds critical threshold`,
        dl_depth, this.thresholds.dead_letter_critical);
    } else if (dl_depth >= this.thresholds.dead_letter_warning) {
      this.fire_alert("dead_letter_depth", "warning",
        `Dead letter queue depth ${dl_depth} exceeds warning threshold`,
        dl_depth, this.thresholds.dead_letter_warning);
    }

    if (circuit_breaker_state === "open") {
      this.fire_alert("circuit_breaker_open", "critical",
        "Circuit breaker is OPEN — pipeline rejecting all attestations",
        1, 0);
    }

    const stall_elapsed = Date.now() - this.last_attestation_at;
    if (this.last_attestation_at > 0 && stall_elapsed > this.thresholds.stall_detection_window_ms) {
      this.fire_alert("pipeline_stall", "critical",
        `No attestations processed for ${(stall_elapsed / 1000).toFixed(0)}s`,
        stall_elapsed, this.thresholds.stall_detection_window_ms);
    }

    this.emit_gauge("circuit_breaker_state", circuit_breaker_state === "closed" ? 0 : circuit_breaker_state === "half_open" ? 1 : 2, {});
    this.emit_gauge("dead_letter_depth", dl_depth, {});
    this.emit_gauge("error_rate_pct", error_rate, {});

    const healthy = this.alerts.every((a) => a.severity !== "critical");

    return {
      healthy,
      circuit_breaker: circuit_breaker_state,
      error_rate_pct: error_rate,
      avg_latency_ms: avg_latency,
      dead_letter_depth: dl_depth,
      alerts: [...this.alerts],
      last_check: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Latency Analysis
  // -----------------------------------------------------------------------

  compute_latency_histogram(stage?: PipelineStage): LatencyHistogram {
    const values = stage
      ? (this.stage_latencies.get(stage) ?? [])
      : this.pipeline_latencies;

    if (values.length === 0) {
      return {
        buckets: HISTOGRAM_BUCKETS.map((le) => ({ le, count: 0 })),
        sum: 0, count: 0, avg: 0, p50: 0, p95: 0, p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      buckets: HISTOGRAM_BUCKETS.map((le) => ({
        le,
        count: sorted.filter((v) => v <= le).length,
      })),
      sum,
      count: sorted.length,
      avg: sum / sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  // -----------------------------------------------------------------------
  // Snapshot Export
  // -----------------------------------------------------------------------

  export_snapshot(metrics: PipelineMetrics): Record<string, unknown> {
    return {
      timestamp: Date.now(),
      namespace: NAMESPACE,
      counters: {
        attestations_received: metrics.attestations_received,
        attestations_bridged: metrics.attestations_bridged,
        attestations_rejected: metrics.attestations_rejected,
        verifications_passed: metrics.verifications_passed,
        verifications_failed: metrics.verifications_failed,
        credits_minted: metrics.credits_minted,
        total_tco2e_minted: metrics.total_tco2e_minted,
        retirements_completed: metrics.retirements_completed,
        total_tco2e_retired: metrics.total_tco2e_retired,
        certificates_generated: metrics.certificates_generated,
        verra_syncs: metrics.verra_syncs,
        dead_letter_count: metrics.dead_letter_count,
        circuit_breaker_trips: metrics.circuit_breaker_trips,
      },
      latencies: {
        avg_pipeline_ms: metrics.avg_pipeline_latency_ms,
        pipeline: this.compute_latency_histogram(),
        by_stage: Object.fromEntries(
          (["bridge_receive", "attestation_adapt", "verification", "credit_mint", "retirement", "certificate", "verra_bridge"] as PipelineStage[])
            .map((s) => [s, this.compute_latency_histogram(s)]),
        ),
      },
      alerts: this.alerts,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  private emit_counter(
    name: string,
    value: number,
    labels: Record<string, string>,
  ): void {
    this.emitted_metrics.push({
      namespace: NAMESPACE,
      name,
      type: "counter",
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  private emit_gauge(
    name: string,
    value: number,
    labels: Record<string, string>,
  ): void {
    this.emitted_metrics.push({
      namespace: NAMESPACE,
      name,
      type: "gauge",
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  private emit_histogram(
    name: string,
    value: number,
    labels: Record<string, string>,
  ): void {
    this.emitted_metrics.push({
      namespace: NAMESPACE,
      name,
      type: "histogram",
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  private fire_alert(
    name: string,
    severity: AlertEvent["severity"],
    message: string,
    value: number,
    threshold: number,
  ): void {
    this.alert_seq++;
    this.alerts.push({
      alert_id: `${NAMESPACE}.${name}.${this.alert_seq}`,
      name,
      severity,
      message,
      value,
      threshold,
      fired_at: Date.now(),
    });
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
