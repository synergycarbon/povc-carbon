/**
 * SynergyCarbon Console — Display Formatters
 *
 * Pure string-formatting functions for Console Kit widgets.
 * All business logic (scoring, risk computation, state machines)
 * lives in FastLang circuits; this file is the thin TypeScript
 * veneer that turns wire-protocol numbers into human-readable text.
 *
 * Rules:
 *  - No state, no side effects, no computation beyond string assembly
 *  - Every function takes primitives in, returns a string out
 */

// ---------------------------------------------------------------------------
// Carbon / Volume
// ---------------------------------------------------------------------------

export function formatTonnesCO2e(tonnes: number): string {
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(2)}M tCO2e`;
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}K tCO2e`;
  return `${tonnes.toFixed(2)} tCO2e`;
}

export function formatTonnesCompact(tonnes: number): string {
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(2)}M`;
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}K`;
  return tonnes.toFixed(2);
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF ',
  JPY: '¥',
};

export function formatCurrency(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Percentage / Delta
// ---------------------------------------------------------------------------

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '—' : '↑ +∞%';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  const arrow = pct >= 0 ? '↑' : '↓';
  return `${arrow} ${sign}${pct.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Confidence / Range
// ---------------------------------------------------------------------------

export function formatConfidenceInterval(low: number, high: number): string {
  return `[${formatTonnesCompact(low)} – ${formatTonnesCompact(high)}]`;
}

// ---------------------------------------------------------------------------
// Risk / Severity (pure display mapping — thresholds set by FL circuit)
// ---------------------------------------------------------------------------

const RISK_SEVERITY_LABELS: Record<number, string> = {
  0: 'normal',
  1: 'elevated',
  2: 'high',
  3: 'critical',
};

export function formatRiskSeverity(level: number): string {
  return RISK_SEVERITY_LABELS[level] ?? `unknown(${level})`;
}

// ---------------------------------------------------------------------------
// Bridge State (pure display mapping — state machine lives in FL circuit)
// ---------------------------------------------------------------------------

const BRIDGE_STATE_LABELS: Record<number, string> = {
  0: 'idle',
  1: 'connecting',
  2: 'authenticating',
  3: 'streaming',
  4: 'draining',
  5: 'disconnected',
  6: 'error',
};

export function formatBridgeState(state: number): string {
  return BRIDGE_STATE_LABELS[state] ?? `unknown(${state})`;
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

export function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export function formatTimestampLocal(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}

export function formatTimeOnly(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString();
}

// ---------------------------------------------------------------------------
// Vintage / Serial
// ---------------------------------------------------------------------------

export function formatVintageYear(year: number): string {
  return `Vintage ${year}`;
}

export function formatSerialNumber(serial: string, maxLen = 16): string {
  if (serial.length <= maxLen) return serial;
  return `${serial.slice(0, maxLen - 3)}…`;
}

// ---------------------------------------------------------------------------
// IEC 62053 Accuracy Class (metering display labels)
// ---------------------------------------------------------------------------

const ACCURACY_CLASS_LABELS: Record<number, string> = {
  1: 'Class 1 (±1%)',
  2: 'Class 2 (±2%)',
  5: 'Class 0.5S (±0.5%)',
  10: 'Class 0.2S (±0.2%)',
};

export function formatAccuracyClass(cls: number): string {
  return ACCURACY_CLASS_LABELS[cls] ?? `Class ${cls}`;
}

// ---------------------------------------------------------------------------
// Power Factor
// ---------------------------------------------------------------------------

export function formatPowerFactor(pf: number): string {
  const abs = Math.abs(pf).toFixed(3);
  if (pf > 0) return `${abs} leading`;
  if (pf < 0) return `${abs} lagging`;
  return abs;
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

export function formatEnergyWh(wh: number): string {
  if (wh >= 1_000_000) return `${(wh / 1_000_000).toFixed(2)} MWh`;
  if (wh >= 1_000) return `${(wh / 1_000).toFixed(1)} kWh`;
  return `${wh.toFixed(0)} Wh`;
}

export function formatPowerKw(wh: number): string {
  return `${(wh / 1_000).toFixed(1)} kW`;
}
