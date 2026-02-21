/**
 * IEC 62053 Energy Metering Types
 *
 * Type definitions for IEC 62053-21 (active energy, electromechanical meters)
 * and IEC 62053-22 (active energy, static meters) compliance.
 *
 * Used by the iec62053_metering.fl circuit and the attestation adapter
 * to validate energy metering telemetry for PoVC attestation.
 *
 * Closes: synergycarbon/povc-carbon #79, #70
 */

// ---------------------------------------------------------------------------
// IEC 62053 Standards
// ---------------------------------------------------------------------------

export enum IecStandard {
  IEC_62053_21 = "IEC-62053-21",
  IEC_62053_22 = "IEC-62053-22",
}

// ---------------------------------------------------------------------------
// Accuracy Classes
// ---------------------------------------------------------------------------

export enum AccuracyClass {
  CLASS_02S = 0, // 0.2S — Revenue-grade (custody transfer, PPA settlement)
  CLASS_05S = 1, // 0.5S — Billing-grade (commercial sub-metering)
  CLASS_10 = 2,  // 1.0  — Monitoring-grade (operational telemetry)
  CLASS_20 = 3,  // 2.0  — Indicative (non-revenue informational)
}

export const ACCURACY_CLASS_LABELS: Record<AccuracyClass, string> = {
  [AccuracyClass.CLASS_02S]: "0.2S",
  [AccuracyClass.CLASS_05S]: "0.5S",
  [AccuracyClass.CLASS_10]: "1.0",
  [AccuracyClass.CLASS_20]: "2.0",
};

/**
 * Maximum permissible percentage error (basis points) per accuracy class
 * at each load point, per IEC 62053-21/22.
 *
 * Index: [5% load, 20% load, 100% load, 120% load]
 */
export const ACCURACY_ERROR_LIMITS: Record<AccuracyClass, [number, number, number, number]> = {
  [AccuracyClass.CLASS_02S]: [40, 20, 20, 20],     // ±0.4%, ±0.2%, ±0.2%, ±0.2%
  [AccuracyClass.CLASS_05S]: [100, 50, 50, 50],     // ±1.0%, ±0.5%, ±0.5%, ±0.5%
  [AccuracyClass.CLASS_10]: [200, 100, 100, 150],   // ±2.0%, ±1.0%, ±1.0%, ±1.5%
  [AccuracyClass.CLASS_20]: [400, 200, 200, 300],   // ±4.0%, ±2.0%, ±2.0%, ±3.0%
};

/**
 * Minimum power factor (cos φ) required per accuracy class (basis points).
 * Revenue metering demands tighter power factor bounds.
 */
export const POWER_FACTOR_THRESHOLDS: Record<AccuracyClass, number> = {
  [AccuracyClass.CLASS_02S]: 8000, // cos φ ≥ 0.80
  [AccuracyClass.CLASS_05S]: 5000, // cos φ ≥ 0.50
  [AccuracyClass.CLASS_10]: 5000,  // cos φ ≥ 0.50
  [AccuracyClass.CLASS_20]: 2000,  // cos φ ≥ 0.20
};

// ---------------------------------------------------------------------------
// Meter Reading
// ---------------------------------------------------------------------------

export interface MeterReading {
  meter_id: Uint8Array;
  meter_type: IecStandard;
  accuracy_class: AccuracyClass;
  voltage_v: number;           // millivolts
  current_ma: number;          // milliamps
  active_power_mw: number;     // milliwatts
  reactive_power_mvar: number; // milli-VAR
  apparent_power_mva: number;  // milli-VA
  power_factor_pct: number;    // 0–10000 (0.00–100.00%)
  frequency_mhz: number;      // milli-Hz (e.g. 60000 = 60 Hz)
  energy_wh: bigint;           // cumulative watt-hours
  timestamp: number;
  site_id: Uint8Array;
  hardware_attestation: Uint8Array;
}

// ---------------------------------------------------------------------------
// Calibration Certificate
// ---------------------------------------------------------------------------

export interface CalibrationCertificate {
  cert_id: Uint8Array;
  meter_id: Uint8Array;
  accuracy_class: AccuracyClass;
  calibration_lab_id: Uint8Array;
  calibrated_at: number;
  expires_at: number;
  se050_attestation: Uint8Array;
  error_pct_at_5: number;   // basis points at 5% load
  error_pct_at_20: number;  // basis points at 20% load
  error_pct_at_100: number; // basis points at 100% load
  error_pct_at_120: number; // basis points at 120% load
  temperature_range_min_c: number;
  temperature_range_max_c: number;
}

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface MeteringValidationResult {
  validation_id: Uint8Array;
  meter_id: Uint8Array;
  accuracy_class: AccuracyClass;
  accuracy_valid: boolean;
  calibration_valid: boolean;
  power_factor_valid: boolean;
  tamper_detected: boolean;
  energy_wh_validated: bigint;
  compliance_flags: number; // bit 0: accuracy, bit 1: calibration, bit 2: pf, bit 3: tamper-free
  validated_at: number;
}

export const COMPLIANCE_FLAG_ACCURACY = 0x01;
export const COMPLIANCE_FLAG_CALIBRATION = 0x02;
export const COMPLIANCE_FLAG_POWER_FACTOR = 0x04;
export const COMPLIANCE_FLAG_TAMPER_FREE = 0x08;
export const COMPLIANCE_FLAGS_ALL = 0x0F;

// ---------------------------------------------------------------------------
// Tamper Detection
// ---------------------------------------------------------------------------

export enum TamperType {
  MAGNETIC = 0,
  COVER_OPEN = 1,
  BYPASS = 2,
  REVERSE_FLOW = 3,
  CLOCK_DRIFT = 4,
}

export enum TamperSeverity {
  INFO = 0,
  WARNING = 1,
  CRITICAL = 2,
}

export interface TamperEvent {
  event_id: Uint8Array;
  meter_id: Uint8Array;
  tamper_type: TamperType;
  severity: TamperSeverity;
  detected_at: number;
  evidence_hash: Uint8Array;
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a calibration certificate's error measurements
 * fall within the permissible limits for the given accuracy class.
 */
export function validateAccuracyErrors(
  cert: CalibrationCertificate,
): { valid: boolean; violations: string[] } {
  const limits = ACCURACY_ERROR_LIMITS[cert.accuracy_class];
  const violations: string[] = [];

  if (cert.error_pct_at_5 > limits[0]) {
    violations.push(
      `Error at 5% load: ${cert.error_pct_at_5} bp exceeds limit ${limits[0]} bp`,
    );
  }
  if (cert.error_pct_at_20 > limits[1]) {
    violations.push(
      `Error at 20% load: ${cert.error_pct_at_20} bp exceeds limit ${limits[1]} bp`,
    );
  }
  if (cert.error_pct_at_100 > limits[2]) {
    violations.push(
      `Error at 100% load: ${cert.error_pct_at_100} bp exceeds limit ${limits[2]} bp`,
    );
  }
  if (cert.error_pct_at_120 > limits[3]) {
    violations.push(
      `Error at 120% load: ${cert.error_pct_at_120} bp exceeds limit ${limits[3]} bp`,
    );
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validate power factor against the threshold for the given accuracy class.
 */
export function validatePowerFactor(
  power_factor_pct: number,
  accuracy_class: AccuracyClass,
): boolean {
  return power_factor_pct >= POWER_FACTOR_THRESHOLDS[accuracy_class];
}

/**
 * Detect potential tamper via power triangle inconsistency.
 * S² should approximately equal P² + Q².
 */
export function checkPowerTriangle(
  active_power_mw: number,
  reactive_power_mvar: number,
  apparent_power_mva: number,
  tolerance_pct: number = 1.0,
): { consistent: boolean; error_pct: number } {
  const p_sq = active_power_mw * active_power_mw;
  const q_sq = reactive_power_mvar * reactive_power_mvar;
  const s_sq = apparent_power_mva * apparent_power_mva;
  const pq_sum = p_sq + q_sq;

  if (s_sq === 0) {
    return { consistent: false, error_pct: 100 };
  }

  const error_pct = (Math.abs(s_sq - pq_sum) / s_sq) * 100;
  return { consistent: error_pct <= tolerance_pct, error_pct };
}

/**
 * Check whether a calibration certificate is currently valid (not expired).
 */
export function isCalibrationValid(
  cert: CalibrationCertificate,
  now_ms?: number,
): boolean {
  const now = now_ms ?? Date.now();
  return cert.expires_at > now;
}

/**
 * Compute the full compliance flags for a metering validation.
 */
export function computeComplianceFlags(
  accuracy_valid: boolean,
  calibration_valid: boolean,
  power_factor_valid: boolean,
  tamper_free: boolean,
): number {
  let flags = 0;
  if (accuracy_valid) flags |= COMPLIANCE_FLAG_ACCURACY;
  if (calibration_valid) flags |= COMPLIANCE_FLAG_CALIBRATION;
  if (power_factor_valid) flags |= COMPLIANCE_FLAG_POWER_FACTOR;
  if (tamper_free) flags |= COMPLIANCE_FLAG_TAMPER_FREE;
  return flags;
}
