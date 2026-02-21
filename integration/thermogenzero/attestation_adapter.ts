/**
 * ThermogenZero Attestation Adapter
 *
 * Handles TZ-specific attestation format, EPA AP-42 methane destruction
 * methodology calculations, and CO2e conversion from raw TEG telemetry.
 *
 * Also validates IEC 62053-compliant energy metering telemetry when
 * present in TZ attestations (closes #79, #70).
 *
 * Bridge path:
 *   TZ FPGA witness nodes → lex_bridge.fl → this adapter → SC verification pipeline
 */

import {
  type MeterReading,
  type CalibrationCertificate,
  type MeteringValidationResult,
  AccuracyClass,
  ACCURACY_CLASS_LABELS,
  COMPLIANCE_FLAGS_ALL,
  validateAccuracyErrors,
  validatePowerFactor,
  checkPowerTriangle,
  isCalibrationValid,
  computeComplianceFlags,
} from "../metering/types";

// ---------------------------------------------------------------------------
// TZ Attestation Types
// ---------------------------------------------------------------------------

export interface TzRawAttestation {
  attestation_hash: Uint8Array;
  reduction_tonnes: bigint;
  methodology_id: Uint8Array;
  witness_signatures: Uint8Array[];
  witness_count: number;
  site_id: Uint8Array;
  epoch_id: number;
  timestamp: number;
  merkle_root: Uint8Array;
  gas_consumed_mcf: number;
  flare_temp_c: number;
  teg_power_w: number;
  metering?: TzMeteringTelemetry;
}

export interface TzMeteringTelemetry {
  meter_id: Uint8Array;
  accuracy_class: AccuracyClass;
  voltage_v: number;
  current_ma: number;
  active_power_mw: number;
  reactive_power_mvar: number;
  apparent_power_mva: number;
  power_factor_pct: number;
  frequency_mhz: number;
  energy_wh: bigint;
}

export interface TzWitnessNode {
  node_id: Uint8Array;
  fpga_platform: number;
  ml_dsa_87_pubkey: Uint8Array;
  site_id: Uint8Array;
  enrolled_at: number;
  last_attestation: number;
}

export interface ScMeasurement {
  measurement_id: Uint8Array;
  sensor_id: Uint8Array;
  value: bigint;
  unit: number;
  timestamp: number;
  location_hash: Uint8Array;
  hardware_attestation: Uint8Array;
  methodology_id: Uint8Array;
}

export interface MethaneDestructionResult {
  tco2e: number;
  gas_consumed_mcf: number;
  destruction_efficiency: number;
  gwp_applied: number;
  methane_destroyed_kg: number;
  co2e_avoided_kg: number;
  methodology_version: string;
  compliant: boolean;
  rejection_reason?: string;
}

export interface Iec62053ValidationResult {
  metering_valid: boolean;
  accuracy_class: AccuracyClass;
  accuracy_class_label: string;
  accuracy_valid: boolean;
  calibration_valid: boolean;
  power_factor_valid: boolean;
  power_triangle_consistent: boolean;
  tamper_detected: boolean;
  compliance_flags: number;
  energy_wh: bigint;
  rejection_reasons: string[];
}

export interface AdapterResult {
  measurement: ScMeasurement;
  methane_calc: MethaneDestructionResult;
  metering_validation?: Iec62053ValidationResult;
  bridged: boolean;
  bridge_timestamp: number;
}

// ---------------------------------------------------------------------------
// EPA AP-42 Methodology Constants
// ---------------------------------------------------------------------------

const EPA_AP42_PARAMS = {
  GWP_FACTOR: 28.0,
  METHANE_DENSITY_KG_PER_MCF: 19.15,
  DEFAULT_DESTRUCTION_EFFICIENCY: 0.995,
  CO2E_PER_MCF_METHANE: 536.2,
  VERIFICATION_DISCOUNT: 0.05,
  MIN_FLARE_TEMP_C: 760.0,
  MAX_ENERGY_DEVIATION_PCT: 5.0,
  BASELINE_DEVIATION_PCT: 20.0,
  METHODOLOGY_VERSION: "EPA-AP42-5.0-S13.5",
  METHODOLOGY_ID: "EPA-AP42-CH4-FLARE",
} as const;

const UNIT_TCO2E = 5;

// ---------------------------------------------------------------------------
// Methane Destruction Calculations
// ---------------------------------------------------------------------------

/**
 * Calculate CO2e reduction from methane destruction via TEG conversion.
 *
 * Formula: tco2e = gas_consumed_mcf * methane_density * gwp * efficiency / 1000
 *
 * Per EPA AP-42 Section 13.5, methane (CH4) has a GWP of 28 over 100 years.
 * Each MCF of methane destroyed avoids ~536.2 kg CO2e when accounting for
 * the full GWP factor and standard methane density.
 */
export function calculateMethaneDestruction(
  gas_consumed_mcf: number,
  flare_temp_c: number,
  teg_power_w: number,
  baseline_power_w?: number,
): MethaneDestructionResult {
  if (gas_consumed_mcf <= 0) {
    return {
      tco2e: 0,
      gas_consumed_mcf,
      destruction_efficiency: 0,
      gwp_applied: EPA_AP42_PARAMS.GWP_FACTOR,
      methane_destroyed_kg: 0,
      co2e_avoided_kg: 0,
      methodology_version: EPA_AP42_PARAMS.METHODOLOGY_VERSION,
      compliant: false,
      rejection_reason: "Gas consumption must be positive",
    };
  }

  if (flare_temp_c < EPA_AP42_PARAMS.MIN_FLARE_TEMP_C) {
    return {
      tco2e: 0,
      gas_consumed_mcf,
      destruction_efficiency: 0,
      gwp_applied: EPA_AP42_PARAMS.GWP_FACTOR,
      methane_destroyed_kg: 0,
      co2e_avoided_kg: 0,
      methodology_version: EPA_AP42_PARAMS.METHODOLOGY_VERSION,
      compliant: false,
      rejection_reason: `Flare temperature ${flare_temp_c}°C below minimum ${EPA_AP42_PARAMS.MIN_FLARE_TEMP_C}°C`,
    };
  }

  if (baseline_power_w !== undefined && baseline_power_w > 0) {
    const deviation_pct =
      Math.abs(teg_power_w - baseline_power_w) / baseline_power_w * 100;
    if (deviation_pct > EPA_AP42_PARAMS.MAX_ENERGY_DEVIATION_PCT) {
      return {
        tco2e: 0,
        gas_consumed_mcf,
        destruction_efficiency: 0,
        gwp_applied: EPA_AP42_PARAMS.GWP_FACTOR,
        methane_destroyed_kg: 0,
        co2e_avoided_kg: 0,
        methodology_version: EPA_AP42_PARAMS.METHODOLOGY_VERSION,
        compliant: false,
        rejection_reason:
          `Energy deviation ${deviation_pct.toFixed(1)}% exceeds maximum ${EPA_AP42_PARAMS.MAX_ENERGY_DEVIATION_PCT}%`,
      };
    }
  }

  const methane_destroyed_kg =
    gas_consumed_mcf * EPA_AP42_PARAMS.METHANE_DENSITY_KG_PER_MCF;

  const destruction_efficiency = deriveDestructionEfficiency(flare_temp_c);

  const co2e_avoided_kg =
    methane_destroyed_kg *
    EPA_AP42_PARAMS.GWP_FACTOR *
    destruction_efficiency;

  const tco2e_gross = co2e_avoided_kg / 1000;
  const tco2e_net = tco2e_gross * (1 - EPA_AP42_PARAMS.VERIFICATION_DISCOUNT);

  return {
    tco2e: tco2e_net,
    gas_consumed_mcf,
    destruction_efficiency,
    gwp_applied: EPA_AP42_PARAMS.GWP_FACTOR,
    methane_destroyed_kg,
    co2e_avoided_kg,
    methodology_version: EPA_AP42_PARAMS.METHODOLOGY_VERSION,
    compliant: true,
  };
}

/**
 * Derive destruction efficiency from flare/combustion temperature.
 * EPA AP-42 assumes >=99.5% at proper operating temps (>760°C).
 * Higher temperatures yield marginal improvement up to 99.9%.
 */
function deriveDestructionEfficiency(flare_temp_c: number): number {
  if (flare_temp_c < EPA_AP42_PARAMS.MIN_FLARE_TEMP_C) return 0;
  if (flare_temp_c >= 1200) return 0.999;
  if (flare_temp_c >= 1000) return 0.998;
  if (flare_temp_c >= 900) return 0.997;
  return EPA_AP42_PARAMS.DEFAULT_DESTRUCTION_EFFICIENCY;
}

// ---------------------------------------------------------------------------
// IEC 62053 Metering Validation
// ---------------------------------------------------------------------------

/**
 * Validate IEC 62053-compliant metering telemetry from a TZ attestation.
 * Checks accuracy class errors against the certificate, power factor,
 * power triangle consistency, and calibration validity.
 */
export function validateIec62053Metering(
  metering: TzMeteringTelemetry,
  calibration_cert?: CalibrationCertificate,
): Iec62053ValidationResult {
  const rejection_reasons: string[] = [];
  const class_label = ACCURACY_CLASS_LABELS[metering.accuracy_class];

  let accuracy_valid = false;
  if (calibration_cert) {
    const accuracy_check = validateAccuracyErrors(calibration_cert);
    accuracy_valid = accuracy_check.valid;
    if (!accuracy_valid) {
      rejection_reasons.push(
        ...accuracy_check.violations.map((v) => `Accuracy: ${v}`),
      );
    }
  } else {
    rejection_reasons.push("No calibration certificate provided");
  }

  let calibration_valid = false;
  if (calibration_cert) {
    calibration_valid = isCalibrationValid(calibration_cert);
    if (!calibration_valid) {
      rejection_reasons.push(
        `Calibration expired at ${new Date(calibration_cert.expires_at).toISOString()}`,
      );
    }
  }

  const power_factor_valid = validatePowerFactor(
    metering.power_factor_pct,
    metering.accuracy_class,
  );
  if (!power_factor_valid) {
    rejection_reasons.push(
      `Power factor ${(metering.power_factor_pct / 100).toFixed(2)}% ` +
        `below threshold for class ${class_label}`,
    );
  }

  const triangle = checkPowerTriangle(
    metering.active_power_mw,
    metering.reactive_power_mvar,
    metering.apparent_power_mva,
  );
  const tamper_detected = !triangle.consistent;
  if (tamper_detected) {
    rejection_reasons.push(
      `Power triangle inconsistency: ${triangle.error_pct.toFixed(2)}% error (tamper suspected)`,
    );
  }

  const compliance_flags = computeComplianceFlags(
    accuracy_valid,
    calibration_valid,
    power_factor_valid,
    !tamper_detected,
  );

  return {
    metering_valid: compliance_flags === COMPLIANCE_FLAGS_ALL,
    accuracy_class: metering.accuracy_class,
    accuracy_class_label: class_label,
    accuracy_valid,
    calibration_valid,
    power_factor_valid,
    power_triangle_consistent: triangle.consistent,
    tamper_detected,
    compliance_flags,
    energy_wh: metering.energy_wh,
    rejection_reasons,
  };
}

// ---------------------------------------------------------------------------
// Attestation Format Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a TZ raw attestation into the SC verification pipeline's
 * Measurement format. The bridge circuit (lex_bridge.fl) calls this
 * adapter to perform the format mapping and methodology calculation
 * before forwarding to submit_measurement.
 *
 * When the attestation includes IEC 62053 metering telemetry, the
 * adapter also validates metering compliance. Both methane methodology
 * and metering must pass for the attestation to bridge successfully.
 */
export function convertTzAttestation(
  attestation: TzRawAttestation,
  calibration_cert?: CalibrationCertificate,
): AdapterResult {
  const methane_calc = calculateMethaneDestruction(
    attestation.gas_consumed_mcf,
    attestation.flare_temp_c,
    attestation.teg_power_w,
  );

  let metering_validation: Iec62053ValidationResult | undefined;
  if (attestation.metering) {
    metering_validation = validateIec62053Metering(
      attestation.metering,
      calibration_cert,
    );
  }

  const measurement: ScMeasurement = {
    measurement_id: deriveMeasurementId(attestation),
    sensor_id: attestation.site_id,
    value: BigInt(Math.round(methane_calc.tco2e * 1_000_000)),
    unit: UNIT_TCO2E,
    timestamp: attestation.timestamp,
    location_hash: attestation.site_id,
    hardware_attestation: attestation.attestation_hash,
    methodology_id: attestation.methodology_id,
  };

  const metering_ok = metering_validation
    ? metering_validation.metering_valid
    : true;

  return {
    measurement,
    methane_calc,
    metering_validation,
    bridged: methane_calc.compliant && metering_ok,
    bridge_timestamp: Date.now(),
  };
}

/**
 * Derive a deterministic measurement ID from the TZ attestation fields.
 * SHA3-256(attestation_hash || epoch_id || timestamp)
 */
function deriveMeasurementId(attestation: TzRawAttestation): Uint8Array {
  const buffer = new Uint8Array(32 + 8 + 8);
  buffer.set(attestation.attestation_hash, 0);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(32, BigInt(attestation.epoch_id), false);
  view.setBigUint64(40, BigInt(attestation.timestamp), false);
  return buffer;
}

// ---------------------------------------------------------------------------
// Batch Processing
// ---------------------------------------------------------------------------

/**
 * Process a batch of TZ attestations for a single epoch.
 * Aggregates per-site results and returns summary statistics.
 *
 * When a calibration_certs map is provided, IEC 62053 metering
 * telemetry is validated against the corresponding certificate.
 */
export function processEpochBatch(
  attestations: TzRawAttestation[],
  baseline_power_w?: number,
  calibration_certs?: Map<string, CalibrationCertificate>,
): {
  results: AdapterResult[];
  total_tco2e: number;
  total_gas_mcf: number;
  compliant_count: number;
  rejected_count: number;
  metering_validated_count: number;
  metering_rejected_count: number;
  rejections: Array<{ epoch_id: number; reason: string }>;
} {
  const results: AdapterResult[] = [];
  let total_tco2e = 0;
  let total_gas_mcf = 0;
  let compliant_count = 0;
  let rejected_count = 0;
  let metering_validated_count = 0;
  let metering_rejected_count = 0;
  const rejections: Array<{ epoch_id: number; reason: string }> = [];

  for (const attestation of attestations) {
    const methane_calc = calculateMethaneDestruction(
      attestation.gas_consumed_mcf,
      attestation.flare_temp_c,
      attestation.teg_power_w,
      baseline_power_w,
    );

    let metering_validation: Iec62053ValidationResult | undefined;
    if (attestation.metering && calibration_certs) {
      const meter_key = Array.from(attestation.metering.meter_id)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const cert = calibration_certs.get(meter_key);
      metering_validation = validateIec62053Metering(
        attestation.metering,
        cert,
      );
    }

    const measurement: ScMeasurement = {
      measurement_id: deriveMeasurementId(attestation),
      sensor_id: attestation.site_id,
      value: BigInt(Math.round(methane_calc.tco2e * 1_000_000)),
      unit: UNIT_TCO2E,
      timestamp: attestation.timestamp,
      location_hash: attestation.site_id,
      hardware_attestation: attestation.attestation_hash,
      methodology_id: attestation.methodology_id,
    };

    const metering_ok = metering_validation
      ? metering_validation.metering_valid
      : true;

    const result: AdapterResult = {
      measurement,
      methane_calc,
      metering_validation,
      bridged: methane_calc.compliant && metering_ok,
      bridge_timestamp: Date.now(),
    };

    results.push(result);

    if (methane_calc.compliant && metering_ok) {
      total_tco2e += methane_calc.tco2e;
      total_gas_mcf += methane_calc.gas_consumed_mcf;
      compliant_count++;
    } else {
      rejected_count++;
      if (!methane_calc.compliant) {
        rejections.push({
          epoch_id: attestation.epoch_id,
          reason: methane_calc.rejection_reason ?? "Unknown",
        });
      }
      if (metering_validation && !metering_ok) {
        rejections.push({
          epoch_id: attestation.epoch_id,
          reason: `IEC 62053: ${metering_validation.rejection_reasons.join("; ")}`,
        });
      }
    }

    if (metering_validation) {
      if (metering_validation.metering_valid) {
        metering_validated_count++;
      } else {
        metering_rejected_count++;
      }
    }
  }

  return {
    results,
    total_tco2e,
    total_gas_mcf,
    compliant_count,
    rejected_count,
    metering_validated_count,
    metering_rejected_count,
    rejections,
  };
}

// ---------------------------------------------------------------------------
// Vintage Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the credit vintage quarter from an attestation timestamp.
 */
export function getVintageQuarter(timestamp_ms: number): {
  year: number;
  quarter: string;
  label: string;
} {
  const date = new Date(timestamp_ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  let quarter: string;
  if (month <= 3) quarter = "Q1";
  else if (month <= 6) quarter = "Q2";
  else if (month <= 9) quarter = "Q3";
  else quarter = "Q4";

  return { year, quarter, label: `${year}-${quarter}` };
}

/**
 * Generate a credit serial number following the SC convention.
 */
export function generateCreditSerial(
  year: number,
  site_id: string,
  sequence: number,
): string {
  const seq_padded = String(sequence).padStart(6, "0");
  return `SC-${year}-tz-${site_id}-${seq_padded}`;
}
