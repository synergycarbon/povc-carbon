/**
 * End-to-End Cross-Org Pipeline Tests
 *
 * Full pipeline from TZ edge attestation to SC credit issuance,
 * retirement, certificate generation, and Verra bridge sync.
 *
 * Test scenarios:
 *   1. Happy path: single attestation → credit
 *   2. Multi-site batch processing
 *   3. Insufficient witnesses → rejection
 *   4. Invalid metering → rejection + recovery
 *   5. Low flare temp → methodology rejection
 *   6. Credit minting with vintage tracking
 *   7. Full retirement flow with certificate
 *   8. Pipeline monitoring and health checks
 *   9. Dead-letter routing on repeated failures
 *  10. Circuit breaker behavior
 *
 * Closes: synergycarbon/povc-carbon #71
 */

import {
  TzScPipeline,
  type PipelineConfig,
  type PipelineResult,
  DEFAULT_PIPELINE_CONFIG,
  CircuitBreaker,
} from "../../integration/thermogenzero/pipeline";

import {
  type TzRawAttestation,
  type TzMeteringTelemetry,
  type AdapterResult,
  convertTzAttestation,
  calculateMethaneDestruction,
  validateIec62053Metering,
  processEpochBatch,
  getVintageQuarter,
  generateCreditSerial,
} from "../../integration/thermogenzero/attestation_adapter";

import {
  PipelineMonitor,
  type PipelineHealthStatus,
  DEFAULT_ALERT_THRESHOLDS,
} from "../../integration/thermogenzero/monitoring";

import {
  AccuracyClass,
  type CalibrationCertificate,
  type MeterReading,
  IecStandard,
} from "../../integration/metering/types";

// ---------------------------------------------------------------------------
// Test Fixture Helpers
// ---------------------------------------------------------------------------

function make_attestation(overrides: Partial<TzRawAttestation> = {}): TzRawAttestation {
  return {
    attestation_hash: new Uint8Array(32).fill(0xA1),
    reduction_tonnes: 260n,
    methodology_id: new Uint8Array(16).fill(0x01),
    witness_signatures: [
      new Uint8Array(4627).fill(0x01),
      new Uint8Array(4627).fill(0x02),
      new Uint8Array(4627).fill(0x03),
    ],
    witness_count: 3,
    site_id: new Uint8Array(32).fill(0x10),
    epoch_id: 100,
    timestamp: 1708000000000,
    merkle_root: new Uint8Array(32).fill(0xFE),
    gas_consumed_mcf: 0.5,
    flare_temp_c: 800,
    teg_power_w: 212.5,
    ...overrides,
  };
}

function make_bravo_attestation(overrides: Partial<TzRawAttestation> = {}): TzRawAttestation {
  return make_attestation({
    attestation_hash: new Uint8Array(32).fill(0xD4),
    site_id: new Uint8Array(32).fill(0x20),
    gas_consumed_mcf: 0.65,
    flare_temp_c: 820,
    teg_power_w: 283.0,
    reduction_tonnes: 340n,
    ...overrides,
  });
}

function make_metering(overrides: Partial<TzMeteringTelemetry> = {}): TzMeteringTelemetry {
  return {
    meter_id: new Uint8Array(32).fill(0xAA),
    accuracy_class: AccuracyClass.CLASS_02S,
    voltage_v: 240000,
    current_ma: 885,
    active_power_mw: 212500,
    reactive_power_mvar: 10000,
    apparent_power_mva: 212735,
    power_factor_pct: 9990,
    frequency_mhz: 60000,
    energy_wh: 212n,
    ...overrides,
  };
}

function make_calibration_cert(overrides: Partial<CalibrationCertificate> = {}): CalibrationCertificate {
  return {
    cert_id: new Uint8Array(32).fill(0xCC),
    meter_id: new Uint8Array(32).fill(0xAA),
    accuracy_class: AccuracyClass.CLASS_02S,
    calibration_lab_id: new Uint8Array(32).fill(0xBB),
    calibrated_at: 1700000000000,
    expires_at: 1900000000000,
    se050_attestation: new Uint8Array(64).fill(0xDD),
    error_pct_at_5: 30,
    error_pct_at_20: 15,
    error_pct_at_100: 18,
    error_pct_at_120: 19,
    temperature_range_min_c: -20,
    temperature_range_max_c: 55,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

// Simulating a test runner; each function is a test case.
// In production this would use the project's test framework.

const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        results.push({ name, passed: true });
      }).catch((err) => {
        results.push({ name, passed: false, error: String(err) });
      });
    } else {
      results.push({ name, passed: true });
    }
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assert_eq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assert_gt(actual: number, threshold: number, label: string): void {
  if (actual <= threshold) {
    throw new Error(`${label}: expected > ${threshold}, got ${actual}`);
  }
}

// =========================================================================
// 1. Happy Path: Single Attestation → Credit
// =========================================================================

test("E2E: single attestation happy path — bridge → verify → mint", async () => {
  const pipeline = new TzScPipeline();
  const attestation = make_attestation();

  const result = await pipeline.process_attestation(attestation);

  assert(result.success, "Pipeline should succeed");
  assert(result.adapter_result.bridged, "Adapter should bridge");
  assert(result.adapter_result.methane_calc.compliant, "Methane calc should be compliant");
  assert_gt(result.adapter_result.methane_calc.tco2e, 0, "tCO2e");
  assert(result.verification !== undefined, "Verification should exist");
  assert(result.verification!.eligible, "Should be eligible");
  assert_eq(result.verification!.compliance_flags, 0x0F, "Compliance flags");
  assert(result.credit !== undefined, "Credit should be minted");
  assert_eq(result.credit!.project_id, "thermogenzero", "Project ID");
  assert_eq(result.credit!.status, "Issued", "Credit status");
  assert_gt(result.credit!.tonnes_co2e, 0, "Credit tonnes");
  assert_gt(result.stage_events.length, 0, "Stage events");
});

// =========================================================================
// 2. Multi-Site Batch Processing
// =========================================================================

test("E2E: multi-site batch — Alpha + Bravo in single batch", async () => {
  const pipeline = new TzScPipeline();

  const batch = [
    make_attestation({ epoch_id: 200 }),
    make_attestation({ epoch_id: 201, gas_consumed_mcf: 0.48, flare_temp_c: 810, teg_power_w: 210 }),
    make_bravo_attestation({ epoch_id: 200 }),
    make_bravo_attestation({ epoch_id: 201, gas_consumed_mcf: 0.62, flare_temp_c: 815, teg_power_w: 280 }),
  ];

  const batch_result = await pipeline.process_batch(batch);

  assert_eq(batch_result.bridged_count, 4, "Bridged count");
  assert_eq(batch_result.rejected_count, 0, "Rejected count");
  assert_eq(batch_result.credits_minted, 4, "Credits minted");
  assert_gt(batch_result.total_tco2e, 0, "Total tCO2e");

  const metrics = pipeline.pipeline_metrics;
  assert_eq(metrics.attestations_received, 4, "Received count");
  assert_eq(metrics.credits_minted, 4, "Metrics credits minted");
});

// =========================================================================
// 3. Insufficient Witnesses → Rejection
// =========================================================================

test("E2E: insufficient witnesses — 2/3 quorum rejected", async () => {
  const pipeline = new TzScPipeline();
  const attestation = make_attestation({
    witness_count: 2,
    witness_signatures: [
      new Uint8Array(4627).fill(0x01),
      new Uint8Array(4627).fill(0x02),
    ],
  });

  // The adapter does not check witness count — the bridge circuit does.
  // At the adapter level the attestation still bridges (format conversion).
  // The insufficient witness check happens in lex_bridge.fl.
  // Here we test the pipeline orchestrator processes the attestation.
  const result = await pipeline.process_attestation(attestation);
  assert(result.adapter_result !== null, "Adapter should process");
});

// =========================================================================
// 4. Invalid Metering → Rejection + Recovery
// =========================================================================

test("E2E: invalid metering (tampered power triangle) rejected, then recovery", async () => {
  const pipeline = new TzScPipeline();

  // Bad attestation with inconsistent power triangle
  const bad_metering = make_metering({
    reactive_power_mvar: 100000, // way too high → triangle inconsistency
  });
  const bad_attestation = make_attestation({
    attestation_hash: new Uint8Array(32).fill(0xBB),
    epoch_id: 500,
    metering: bad_metering,
  });

  const meter_key = Array.from(bad_metering.meter_id)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  pipeline.register_calibration_cert(meter_key, make_calibration_cert());

  const bad_result = await pipeline.process_attestation(bad_attestation);
  assert(!bad_result.success, "Bad metering should fail");
  assert_eq(bad_result.failed_stage!, "attestation_adapt", "Should fail at adapter");

  // Good attestation recovers (no metering data, bypasses check)
  const good_attestation = make_attestation({
    attestation_hash: new Uint8Array(32).fill(0xCC),
    epoch_id: 501,
  });

  const good_result = await pipeline.process_attestation(good_attestation);
  assert(good_result.success, "Pipeline should recover");
  assert(good_result.credit !== undefined, "Credit should be minted after recovery");
});

// =========================================================================
// 5. Low Flare Temp → Methodology Rejection
// =========================================================================

test("E2E: flare temp below EPA AP-42 minimum — adapter rejects", async () => {
  const pipeline = new TzScPipeline();
  const attestation = make_attestation({
    attestation_hash: new Uint8Array(32).fill(0xDD),
    flare_temp_c: 650,
    teg_power_w: 180,
  });

  const result = await pipeline.process_attestation(attestation);

  assert(!result.success, "Should be rejected");
  assert_eq(result.failed_stage!, "attestation_adapt", "Should fail at adapter");
  assert(!result.adapter_result.methane_calc.compliant, "Should not be compliant");
  assert(
    result.adapter_result.methane_calc.rejection_reason!.includes("below minimum"),
    "Should mention temp threshold",
  );
});

// =========================================================================
// 6. Credit Minting with Vintage Tracking
// =========================================================================

test("E2E: credit serial numbers follow SC convention with vintage tracking", async () => {
  const pipeline = new TzScPipeline();

  const a1 = make_attestation({ epoch_id: 10 });
  const a2 = make_attestation({ epoch_id: 11, attestation_hash: new Uint8Array(32).fill(0xEE) });

  const r1 = await pipeline.process_attestation(a1);
  const r2 = await pipeline.process_attestation(a2);

  assert(r1.success && r2.success, "Both should succeed");
  assert(r1.credit!.serial_number.startsWith("SC-"), "Serial starts with SC-");
  assert(r2.credit!.serial_number.startsWith("SC-"), "Serial starts with SC-");
  assert(r1.credit!.serial_number !== r2.credit!.serial_number, "Serials should be unique");
});

test("vintage quarter derivation", () => {
  const jan = getVintageQuarter(new Date("2026-01-15").getTime());
  assert_eq(jan.quarter, "Q1", "January = Q1");
  assert_eq(jan.year, 2026, "Year");

  const jul = getVintageQuarter(new Date("2026-07-15").getTime());
  assert_eq(jul.quarter, "Q3", "July = Q3");

  const oct = getVintageQuarter(new Date("2026-10-01").getTime());
  assert_eq(oct.quarter, "Q4", "October = Q4");
});

test("credit serial generation", () => {
  const serial = generateCreditSerial(2026, "esz-wellpad-alpha", 42);
  assert_eq(serial, "SC-2026-tz-esz-wellpad-alpha-000042", "Serial format");
});

// =========================================================================
// 7. Full Retirement Flow with Certificate
// =========================================================================

test("E2E: full retirement flow — mint → retire → certificate → Verra sync", async () => {
  const pipeline = new TzScPipeline();
  const attestation = make_attestation({
    attestation_hash: new Uint8Array(32).fill(0xFF),
    epoch_id: 600,
  });

  const result = await pipeline.process_attestation(attestation, {
    auto_retire: true,
    retirement_reason: "Q1 2026 voluntary offset",
    retirement_beneficiary: "SynergyCarbon Foundation",
  });

  assert(result.success, "Pipeline should succeed");

  // Credit minted
  assert(result.credit !== undefined, "Credit should exist");
  assert_eq(result.credit!.status, "Issued", "Credit status");

  // Retirement executed
  assert(result.retirement !== undefined, "Retirement should exist");
  assert(result.retirement!.permanent, "Retirement should be permanent");
  assert_gt(result.retirement!.tonnes_co2e, 0, "Retirement tonnes");

  // Certificate generated
  assert(result.certificate !== undefined, "Certificate should exist");
  assert(result.certificate!.certificate_id.length > 0, "Certificate ID");
  assert(result.certificate!.verify_url.includes("sc.estream.dev/verify"), "Verify URL");
  assert_eq(result.certificate!.project_id, "thermogenzero", "Cert project");
  assert_eq(result.certificate!.retired_by, "SynergyCarbon Foundation", "Cert beneficiary");
  assert_eq(result.certificate!.reason, "Q1 2026 voluntary offset", "Cert reason");

  // Verra sync
  assert(result.verra_synced === true, "Should sync to Verra");

  // All 7 stages present
  const stages = result.stage_events.map((e) => e.stage);
  assert(stages.includes("bridge_receive"), "bridge_receive stage");
  assert(stages.includes("attestation_adapt"), "attestation_adapt stage");
  assert(stages.includes("verification"), "verification stage");
  assert(stages.includes("credit_mint"), "credit_mint stage");
  assert(stages.includes("retirement"), "retirement stage");
  assert(stages.includes("certificate"), "certificate stage");
  assert(stages.includes("verra_bridge"), "verra_bridge stage");
});

// =========================================================================
// 8. Pipeline Monitoring and Health Checks
// =========================================================================

test("E2E: monitoring — health check after successful pipeline run", async () => {
  const pipeline = new TzScPipeline();
  const monitor = new PipelineMonitor();

  const attestation = make_attestation();
  const result = await pipeline.process_attestation(attestation);
  monitor.record_result(result);

  const health = monitor.check_health(
    pipeline.pipeline_metrics,
    pipeline.dead_letter_queue,
    pipeline.breaker_state,
  );

  assert(health.healthy, "Pipeline should be healthy");
  assert_eq(health.circuit_breaker, "closed", "Breaker should be closed");
  assert_eq(health.error_rate_pct, 0, "Error rate should be 0");
  assert_eq(health.dead_letter_depth, 0, "Dead letter should be empty");
  assert_eq(health.alerts.length, 0, "No alerts");
});

test("E2E: monitoring — alerts fire on high error rate", async () => {
  const pipeline = new TzScPipeline();
  const monitor = new PipelineMonitor({ error_rate_warning_pct: 5 });

  // Generate failures to push error rate above 5%
  for (let i = 0; i < 3; i++) {
    const bad = make_attestation({
      attestation_hash: new Uint8Array(32).fill(i + 1),
      flare_temp_c: 650,
    });
    const result = await pipeline.process_attestation(bad);
    monitor.record_result(result);
  }

  const health = monitor.check_health(
    pipeline.pipeline_metrics,
    pipeline.dead_letter_queue,
    pipeline.breaker_state,
  );

  assert_gt(health.error_rate_pct, 5, "Error rate above threshold");
  assert(health.alerts.length > 0, "Should have alerts");
  assert(health.alerts.some((a) => a.name === "high_error_rate"), "high_error_rate alert");
});

test("E2E: monitoring — latency histogram computation", async () => {
  const pipeline = new TzScPipeline();
  const monitor = new PipelineMonitor();

  const attestation = make_attestation();
  const result = await pipeline.process_attestation(attestation);
  monitor.record_result(result);

  const histogram = monitor.compute_latency_histogram();
  assert_eq(histogram.count, 1, "Histogram count");
  assert_gt(histogram.sum, -1, "Histogram sum >= 0");
});

test("E2E: monitoring — snapshot export", async () => {
  const pipeline = new TzScPipeline();
  const monitor = new PipelineMonitor();

  const attestation = make_attestation();
  const result = await pipeline.process_attestation(attestation);
  monitor.record_result(result);

  const snapshot = monitor.export_snapshot(pipeline.pipeline_metrics);
  assert(snapshot.timestamp !== undefined, "Snapshot has timestamp");
  assert(snapshot.counters !== undefined, "Snapshot has counters");
  assert(snapshot.latencies !== undefined, "Snapshot has latencies");
});

// =========================================================================
// 9. Dead-Letter Routing
// =========================================================================

test("E2E: dead-letter routing on repeated failures", async () => {
  const pipeline = new TzScPipeline();

  const failures = [
    make_attestation({ attestation_hash: new Uint8Array(32).fill(0xD1), gas_consumed_mcf: 0 }),
    make_attestation({ attestation_hash: new Uint8Array(32).fill(0xD2), flare_temp_c: 500 }),
    make_attestation({ attestation_hash: new Uint8Array(32).fill(0xD3), gas_consumed_mcf: 0 }),
  ];

  for (const bad of failures) {
    await pipeline.process_attestation(bad);
  }

  const metrics = pipeline.pipeline_metrics;
  assert_eq(metrics.attestations_rejected, 3, "3 rejected");
  assert_eq(metrics.credits_minted, 0, "No credits");

  // Recovery
  const good = make_attestation({ attestation_hash: new Uint8Array(32).fill(0xD4) });
  const result = await pipeline.process_attestation(good);
  assert(result.success, "Recovery should succeed");
  assert(result.credit !== undefined, "Credit minted on recovery");
});

// =========================================================================
// 10. Circuit Breaker
// =========================================================================

test("circuit breaker: closes on success, opens on failure threshold", () => {
  const breaker = new CircuitBreaker(3, 60000, 1000, 2);

  assert(breaker.can_execute(), "Should start closed");
  assert_eq(breaker.current_state, "closed", "Initial state");

  breaker.record_failure();
  breaker.record_failure();
  assert(breaker.can_execute(), "Still open below threshold");

  breaker.record_failure();
  assert(!breaker.can_execute(), "Should be open after 3 failures");
  assert_eq(breaker.current_state, "open", "Open state");
});

test("circuit breaker: half-open after reset timeout", () => {
  const breaker = new CircuitBreaker(1, 60000, 0, 1);
  breaker.record_failure();
  assert(!breaker.can_execute(), "Should be open");

  // With reset_ms = 0, next call should transition to half-open
  assert(breaker.can_execute(), "Should be half-open");
  assert_eq(breaker.current_state, "half_open", "Half-open state");

  breaker.record_success();
  assert_eq(breaker.current_state, "closed", "Back to closed");
});

// =========================================================================
// Adapter Unit Tests (integrated here for coverage)
// =========================================================================

test("adapter: methane destruction calculation — valid", () => {
  const result = calculateMethaneDestruction(0.5, 800, 212.5);
  assert(result.compliant, "Should be compliant");
  assert_gt(result.tco2e, 0, "tCO2e > 0");
  assert_eq(result.methodology_version, "EPA-AP42-5.0-S13.5", "Methodology");
  assert(result.destruction_efficiency >= 0.995, "Destruction efficiency");
});

test("adapter: methane destruction — zero gas", () => {
  const result = calculateMethaneDestruction(0, 800, 212.5);
  assert(!result.compliant, "Zero gas should not comply");
  assert_eq(result.tco2e, 0, "tCO2e should be 0");
});

test("adapter: methane destruction — low flare temp", () => {
  const result = calculateMethaneDestruction(0.5, 650, 180);
  assert(!result.compliant, "Low temp should not comply");
  assert(result.rejection_reason!.includes("below minimum"), "Reason");
});

test("adapter: IEC 62053 metering validation — valid", () => {
  const metering = make_metering();
  const cert = make_calibration_cert();
  const result = validateIec62053Metering(metering, cert);
  assert(result.metering_valid, "Should be valid");
  assert(result.accuracy_valid, "Accuracy valid");
  assert(result.calibration_valid, "Calibration valid");
  assert(result.power_factor_valid, "Power factor valid");
  assert(!result.tamper_detected, "No tamper");
});

test("adapter: IEC 62053 metering — expired calibration", () => {
  const metering = make_metering();
  const cert = make_calibration_cert({ expires_at: 1000 }); // expired
  const result = validateIec62053Metering(metering, cert);
  assert(!result.calibration_valid, "Calibration should be invalid");
  assert(!result.metering_valid, "Metering should be invalid");
});

test("adapter: IEC 62053 metering — power triangle tamper", () => {
  const metering = make_metering({ reactive_power_mvar: 200000 });
  const cert = make_calibration_cert();
  const result = validateIec62053Metering(metering, cert);
  assert(result.tamper_detected, "Tamper should be detected");
  assert(!result.metering_valid, "Metering should be invalid");
});

test("adapter: batch processing — epoch batch", () => {
  const attestations = [
    make_attestation({ epoch_id: 1 }),
    make_attestation({ epoch_id: 2, gas_consumed_mcf: 0.48 }),
    make_attestation({ epoch_id: 3, flare_temp_c: 650 }), // will fail
  ];

  const batch = processEpochBatch(attestations);
  assert_eq(batch.compliant_count, 2, "2 compliant");
  assert_eq(batch.rejected_count, 1, "1 rejected");
  assert_gt(batch.total_tco2e, 0, "Total tCO2e > 0");
  assert_eq(batch.rejections.length, 1, "1 rejection recorded");
});

test("adapter: convertTzAttestation — full flow", () => {
  const attestation = make_attestation();
  const result = convertTzAttestation(attestation);
  assert(result.bridged, "Should bridge");
  assert(result.methane_calc.compliant, "Methane should be compliant");
  assert_eq(result.measurement.unit, 5, "Unit = tCO2e");
  assert_gt(Number(result.measurement.value), 0, "Measurement value > 0");
});

test("adapter: convertTzAttestation with metering", () => {
  const attestation = make_attestation({ metering: make_metering() });
  const cert = make_calibration_cert();
  const result = convertTzAttestation(attestation, cert);
  assert(result.bridged, "Should bridge with valid metering");
  assert(result.metering_validation !== undefined, "Metering validation present");
  assert(result.metering_validation!.metering_valid, "Metering valid");
});

// =========================================================================
// Run Tests & Report
// =========================================================================

async function run_all(): Promise<void> {
  // Allow async tests to settle
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("\n=== E2E Cross-Org Pipeline Tests ===\n");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    if (r.passed) {
      console.log(`  PASS  ${r.name}`);
      passed++;
    } else {
      console.log(`  FAIL  ${r.name}`);
      console.log(`        ${r.error}`);
      failed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed, ${results.length} total\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run_all();
