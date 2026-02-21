/**
 * Risk Alert Generation and Threshold Management
 *
 * Generates alerts when risk scores exceed configured thresholds.
 * Supports per-dimension thresholds, cool-down periods, escalation
 * chains, and StreamSight integration for observability.
 *
 * Alert pipeline:
 *   RiskMetric (hourly) → threshold check → emit to sc.ai.risk.alerts.{tenant}
 *     → Console risk-monitor widget
 *     → Webhook: risk.threshold_exceeded (if B2B API configured)
 */

import type { RiskScore, CompositeRiskScore, Severity } from './risk_engine';
import { SEVERITY, RISK_TYPE } from './risk_engine';

// ---------------------------------------------------------------------------
// Alert Types
// ---------------------------------------------------------------------------

export interface RiskAlert {
  alert_id: string;
  target_id: string;
  risk_type: number;
  severity: Severity;
  score: number;
  threshold: number;
  message: string;
  mitigation_suggestions: string[];
  created_at: number;
  acknowledged: boolean;
  escalated: boolean;
}

export interface AlertThreshold {
  risk_type: number;
  warning_score: number;
  critical_score: number;
  cooldown_s: number;
}

export interface EscalationRule {
  severity: Severity;
  auto_escalate_after_s: number;
  notify_channels: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AlertConfig {
  thresholds: AlertThreshold[];
  escalation_rules: EscalationRule[];
  global_cooldown_s: number;
  max_active_alerts: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  thresholds: [
    { risk_type: RISK_TYPE.COUNTERPARTY, warning_score: 50, critical_score: 75, cooldown_s: 3_600 },
    { risk_type: RISK_TYPE.DELIVERY, warning_score: 50, critical_score: 75, cooldown_s: 3_600 },
    { risk_type: RISK_TYPE.MARKET, warning_score: 50, critical_score: 75, cooldown_s: 1_800 },
    { risk_type: RISK_TYPE.METHODOLOGY, warning_score: 50, critical_score: 75, cooldown_s: 7_200 },
  ],
  escalation_rules: [
    {
      severity: SEVERITY.ELEVATED,
      auto_escalate_after_s: 7_200,
      notify_channels: ['console', 'webhook'],
    },
    {
      severity: SEVERITY.CRITICAL,
      auto_escalate_after_s: 1_800,
      notify_channels: ['console', 'webhook', 'governance'],
    },
  ],
  global_cooldown_s: 300,
  max_active_alerts: 500,
};

// ---------------------------------------------------------------------------
// Alert Manager
// ---------------------------------------------------------------------------

export class AlertManager {
  private config: AlertConfig;
  private active_alerts: Map<string, RiskAlert> = new Map();
  private last_alert_times: Map<string, number> = new Map();
  private alert_counter = 0;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
  }

  evaluate(
    target_id: string,
    risk_score: RiskScore,
    timestamp: number,
  ): RiskAlert | null {
    const threshold = this.config.thresholds.find(t => t.risk_type === risk_score.risk_type);
    if (!threshold) return null;

    const is_warning = risk_score.score >= threshold.warning_score;
    const is_critical = risk_score.score >= threshold.critical_score;

    if (!is_warning) {
      this.resolve_for(target_id, risk_score.risk_type);
      return null;
    }

    const cooldown_key = `${target_id}:${risk_score.risk_type}`;
    const last_alert = this.last_alert_times.get(cooldown_key) ?? 0;
    if (timestamp - last_alert < threshold.cooldown_s) return null;

    const alert: RiskAlert = {
      alert_id: this.next_alert_id(),
      target_id,
      risk_type: risk_score.risk_type,
      severity: risk_score.severity,
      score: risk_score.score,
      threshold: is_critical ? threshold.critical_score : threshold.warning_score,
      message: format_alert_message(risk_score, is_critical),
      mitigation_suggestions: risk_score.mitigation_suggestions,
      created_at: timestamp,
      acknowledged: false,
      escalated: false,
    };

    this.active_alerts.set(alert.alert_id, alert);
    this.last_alert_times.set(cooldown_key, timestamp);
    this.enforce_max_alerts();

    return alert;
  }

  evaluate_composite(
    composite: CompositeRiskScore,
    timestamp: number,
  ): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    for (const dim of composite.dimensions) {
      const alert = this.evaluate(composite.target_id, dim, timestamp);
      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  check_escalations(timestamp: number): RiskAlert[] {
    const escalated: RiskAlert[] = [];

    for (const alert of this.active_alerts.values()) {
      if (alert.acknowledged || alert.escalated) continue;

      const rule = this.config.escalation_rules.find(r => r.severity === alert.severity);
      if (!rule) continue;

      if (timestamp - alert.created_at >= rule.auto_escalate_after_s) {
        alert.escalated = true;
        escalated.push(alert);
      }
    }

    return escalated;
  }

  acknowledge(alert_id: string): boolean {
    const alert = this.active_alerts.get(alert_id);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  resolve(alert_id: string): boolean {
    return this.active_alerts.delete(alert_id);
  }

  get_active_alerts(): RiskAlert[] {
    return [...this.active_alerts.values()].sort((a, b) => b.score - a.score);
  }

  get_alerts_for_target(target_id: string): RiskAlert[] {
    return [...this.active_alerts.values()]
      .filter(a => a.target_id === target_id)
      .sort((a, b) => b.score - a.score);
  }

  get_critical_count(): number {
    return [...this.active_alerts.values()]
      .filter(a => a.severity === SEVERITY.CRITICAL && !a.acknowledged)
      .length;
  }

  private resolve_for(target_id: string, risk_type: number): void {
    for (const [id, alert] of this.active_alerts) {
      if (alert.target_id === target_id && alert.risk_type === risk_type) {
        this.active_alerts.delete(id);
      }
    }
  }

  private next_alert_id(): string {
    this.alert_counter++;
    return `alert-${Date.now()}-${this.alert_counter}`;
  }

  private enforce_max_alerts(): void {
    if (this.active_alerts.size <= this.config.max_active_alerts) return;

    const sorted = [...this.active_alerts.entries()]
      .sort((a, b) => a[1].score - b[1].score);

    while (this.active_alerts.size > this.config.max_active_alerts && sorted.length > 0) {
      const [id] = sorted.shift()!;
      this.active_alerts.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_TYPE_LABELS: Record<number, string> = {
  [RISK_TYPE.COUNTERPARTY]: 'Counterparty',
  [RISK_TYPE.DELIVERY]: 'Delivery',
  [RISK_TYPE.MARKET]: 'Market',
  [RISK_TYPE.METHODOLOGY]: 'Methodology',
};

function format_alert_message(score: RiskScore, is_critical: boolean): string {
  const type_label = RISK_TYPE_LABELS[score.risk_type] ?? 'Unknown';
  const level = is_critical ? 'CRITICAL' : 'WARNING';
  return `${level}: ${type_label} risk score ${score.score.toFixed(1)} exceeds threshold`;
}
