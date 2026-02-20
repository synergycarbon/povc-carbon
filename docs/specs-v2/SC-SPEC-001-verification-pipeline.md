# SC-SPEC-001: Verification Pipeline

> **Status**: Draft
> **Version**: 2.0.0
> **Date**: 2026-02-20
> **Scope**: PoVCR protocol, witness threshold verification, attestation chain, compliance mapping
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)
> **Compliance**: EPA GHG (40 CFR Part 98), ISO 14064-2, Verra VCS, Gold Standard

---

## 1. Overview

The verification pipeline is the trust root of SynergyCarbon. Every carbon credit originates from a hardware-attested measurement that passes through a multi-witness verification protocol before becoming eligible for issuance. The pipeline enforces cryptographic provenance from sensor to credit — no spreadsheet-based claims, no periodic audits as the sole evidence.

The protocol is called **PoVCR** (Proof of Verified Carbon Reduction). It chains hardware attestations through Merkle commitments, subjects them to independent witness verification, and produces a tamper-evident audit trail signed with ML-DSA-87 post-quantum signatures.

---

## 2. PoVCR Protocol

### 2.1 Pipeline Stages

```
Sensor → Attestation → Merkle Commitment → Witness Verification → Credit Eligibility
```

1. **Hardware-attested measurement**: A Carbon Witness Node (ARM64 + SE050) samples the energy source and signs the reading with its device-resident ML-DSA-87 key.
2. **Merkle commitment**: Attestations are batched into time-windowed Merkle trees (default: 15-minute epochs). The root is published to the lex topic `sc.attestations.{project_id}.roots`.
3. **Multi-witness verification**: Independent verifier nodes validate attestations against the applicable methodology, check signature validity, and vote on the batch.
4. **Credit eligibility**: Batches that pass the witness threshold are marked `VERIFIED` and become eligible for credit issuance in the Credit Registry (SC-SPEC-002).

### 2.2 Witness Thresholds

| Mode | Threshold | Use Case |
|------|-----------|----------|
| Standard | 3-of-5 | Projects > 500 tCO2e/year or any project with forward contracts |
| Expedited | 2-of-3 | Projects ≤ 500 tCO2e/year, no forward contracts, established methodology |

Threshold selection is recorded in the attestation metadata and cannot be changed mid-epoch. Verifiers are drawn from the credentialed pool (see SC-SPEC-004).

---

## 3. Attestation Structure

Each attestation is a signed envelope containing a measurement payload:

```
Attestation {
  attestation_id   : UUID v7
  sensor_id        : bytes(32)          # Witness Node hardware identity
  project_id       : string             # lex project key
  value            : float64            # measured quantity
  unit             : enum(kWh, tCO2e, m3, W, kg)
  timestamp        : uint64             # Unix epoch ms
  location_hash    : bytes(32)          # SHA3-256(lat || lon || altitude)
  methodology      : string             # e.g. "VM0006-v1.2"
  baseline_ref     : bytes(32)          # hash of applicable baseline document
  epoch_id         : uint64             # Merkle epoch sequence number
  signature        : ML-DSA-87          # over SHA3-256(payload)
}
```

**Privacy**: Raw GPS coordinates never leave the device. Only `location_hash` is transmitted, preventing geolocation attacks on project sites while preserving audit verifiability via known-location challenge.

---

## 4. Verification Steps

### Step 1 — Receive Attestation

The verification pipeline subscribes to `sc.attestations.{project_id}.raw`. Incoming attestations are buffered until the epoch window closes.

### Step 2 — Validate ML-DSA-87 Signature

Each attestation's `signature` is verified against the `sensor_id` public key registered in the device credential store. Failed signatures are rejected with `INVALID_SIGNATURE` and forwarded to the anomaly pipeline.

### Step 3 — Check Methodology Compliance

The attestation's `methodology` field is resolved to the active methodology version (SC-SPEC-004). The verifier checks:
- Value is within plausible range for the source type
- Unit matches methodology requirement
- Sampling interval conforms to methodology minimum frequency
- Baseline reference matches the current approved baseline

### Step 4 — Verify Merkle Inclusion

The attestation is checked for inclusion in the epoch Merkle tree. The Merkle proof is validated against the published root on `sc.attestations.{project_id}.roots`.

### Step 5 — Cross-Check Against Baseline

The measured value is compared to the project baseline:
- `reduction = baseline_value - measured_value`
- Negative reductions (emissions above baseline) flag the attestation as `BASELINE_EXCEEDED`
- Reduction is capped at the methodology-defined maximum creditable rate

### Step 6 — Emit VerificationResult

```
VerificationResult {
  result_id        : UUID v7
  attestation_id   : UUID v7
  epoch_id         : uint64
  verifier_id      : bytes(32)
  verdict          : enum(VERIFIED, REJECTED, FLAGGED)
  reason           : string             # empty if VERIFIED
  reduction_tco2e  : float64
  methodology_ver  : string
  witness_sig      : ML-DSA-87
  timestamp        : uint64
}
```

A batch reaches `VERIFIED` status when the witness threshold is met (3-of-5 or 2-of-3). The final `VerificationResult` aggregates individual witness verdicts and is Merkle-chained into the verification series.

---

## 5. Compliance Frameworks

### 5.1 EPA GHG (40 CFR Part 98)

- Subpart C (General Stationary Fuel Combustion): emission factors, heat content verification
- Subpart W (Petroleum and Natural Gas): methane leak detection thresholds
- Reporting: annual GHG reports auto-generated from verified attestation data

### 5.2 ISO 14064-2

- Project-level quantification of GHG emission reductions
- Monitoring plan mapped to attestation sampling intervals
- Uncertainty assessment derived from sensor calibration metadata

### 5.3 Verra VCS

- **VM0006**: Methodology for carbon accounting of waste gas recovery
- **VM0007**: REDD+ methodology (nature-based, future adapter)
- Project registration document auto-populated from lex project metadata
- Monitoring reports generated from aggregated verification results

### 5.4 Gold Standard

- Activity requirements mapped to attestation methodology fields
- Sustainable Development Goal (SDG) contributions tracked as overlay metadata
- MRV (Measurement, Reporting, Verification) aligned with hardware attestation cadence

---

## 6. Audit Trail

Every verification decision is PoVC-witnessed and Merkle-chained into an append-only audit series. The audit trail includes:

- Original attestation (by reference — attestation_id + Merkle proof)
- Each verifier's individual verdict and signature
- Aggregated batch result
- Any anomaly flags and their resolution
- Methodology version active at time of verification

Audit events are published to `sc.audit.{project_id}.verification` and fanned up to the registry-level audit aggregate.

---

## 7. StreamSight Anomaly Detection

The verification pipeline emits telemetry to StreamSight under the lex namespace `esn/sustainability/carbon/org/synergycarbon/project/{project_id}/verification/`.

### Monitored Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| `verification_rate` | < 95% | `WARN` — possible sensor degradation or methodology mismatch |
| `signature_failure_rate` | > 1% | `CRITICAL` — potential device compromise |
| `baseline_exceed_rate` | > 10% | `WARN` — baseline may need recalibration |
| `epoch_latency_ms` | > 30000 | `WARN` — verification backlog forming |
| `witness_disagreement_rate` | > 20% | `CRITICAL` — verifier consensus breakdown |

Anomalies trigger events on `sc.anomalies.{project_id}.verification` and are surfaced in the operator console (SC-OPS).

---

## 8. Graph Model — verification_pipeline DAG

### 8.1 Node Types

| Node | Description | Key Fields |
|------|-------------|------------|
| `Measurement` | Raw sensor reading before attestation | sensor_id, value, unit, timestamp |
| `Attestation` | Signed measurement with Merkle commitment | attestation_id, epoch_id, signature |
| `VerificationResult` | Witness verdict on an attestation batch | result_id, verdict, reduction_tco2e |
| `AuditEvent` | Immutable audit record of a verification action | event_id, event_type, actor_id |

### 8.2 Edge Types

| Edge | From → To | Semantics |
|------|-----------|-----------|
| `attests` | Measurement → Attestation | Sensor signs a measurement |
| `verifies` | Attestation → VerificationResult | Witness evaluates an attestation |
| `audits` | VerificationResult → AuditEvent | Decision recorded in audit trail |

### 8.3 Series

**`verification_chain`**
- Append-only series with Merkle-chaining
- Each entry: `{ epoch_id, merkle_root, batch_verdict, witness_sigs[], reduction_total }`
- PoVC imprint: the series root is co-signed by the verification pipeline's own ML-DSA-87 key

### 8.4 Overlays

| Overlay | Scope | Description |
|---------|-------|-------------|
| `verification_status` | Per-attestation | Current status: PENDING, VERIFIED, REJECTED, FLAGGED |
| `anomaly_score` | Per-epoch | Composite anomaly score from StreamSight (0.0–1.0) |
| `methodology_match` | Per-attestation | Boolean — attestation conforms to active methodology version |

---

## 9. Lex Integration

```
esn/sustainability/carbon/org/synergycarbon/
  project/{project_id}/
    verification/
      attestations/        # Raw attestation stream
      roots/               # Epoch Merkle roots
      results/             # VerificationResult records
      audit/               # Audit trail events
      anomalies/           # StreamSight anomaly events
```

Fan-up rule: only `VERIFIED_BATCH_SUMMARY` events propagate to the registry-level lex topic. Raw attestations and individual witness verdicts remain in the project sub-lex.

---

## 10. Security Considerations

- **Key rotation**: Witness Node ML-DSA-87 keys rotate annually; old keys remain valid for audit verification via the key history chain
- **Verifier independence**: No single organization may control > 2 of 5 verifier seats for standard threshold
- **Replay protection**: Each attestation includes `epoch_id` + `timestamp`; duplicate attestations within the same epoch are rejected
- **Quantum resistance**: All signatures use ML-DSA-87 (FIPS 204); Merkle trees use SHA3-256

---

## References

- [SC-SPEC-002](SC-SPEC-002-credit-registry.md) — Credit Registry (consumes verified batches)
- [SC-SPEC-004](SC-SPEC-004-governance.md) — Governance (methodology approval, verifier credentialing)
- [SC-SPEC-005](SC-SPEC-005-source-adapters.md) — Source Adapters (hardware witness nodes)
- [DESIGN.md](../DESIGN.md) — Platform design narrative
- EPA 40 CFR Part 98 — Mandatory Greenhouse Gas Reporting
- ISO 14064-2:2019 — Project-level quantification of GHG reductions
- Verra VCS Program Guide v4.5
- FIPS 204 — ML-DSA (Module-Lattice Digital Signature Algorithm)
