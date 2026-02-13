# Verification & Attestation — Patent Cross-Reference

> **Spec Collection:** verification  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `povc-carbon-credit` — Cluster B (CRITICAL)

**Filing Status:** Draft (CIP Ready — claims priority from WO2023205756A2, April 2022)  
**Patent Location:** `synergythermogen/ip/patents/povc-carbon-credit/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Hardware attestation with ML-DSA-87 signatures | Witness signature verification (Step 1) | `povcr_verifier` — signature_check node |
| Causal chain verification (CH4 -> Heat -> Power) | Energy claim cross-validation (Step 5) | `povcr_verifier` — energy_claim_validator node |
| Continuous verification (every reading, not annual audits) | Real-time attestation on each epoch | `povcr_verifier` — quorum_collector node |
| Third-party verifiable through PoVC replay | Attestation records with Merkle proofs on `sc.attestations.verified` | `povcr_verifier` — attestation_builder node |
| Claim 11: Source-agnostic (solar, wind, geothermal, industrial, methane) | Methodology registry + pluggable carbon calculation | `povcr_verifier` — carbon_calculator node |

### `provenance-chain` — Cluster B (HIGH)

**Filing Status:** Draft (Ready for filing)  
**Patent Location:** `synergythermogen/ip/patents/provenance-chain/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Append-only provenance chain | Audit trail with immutable event log | `audit_trail` — event_log node |
| Aggregation/splitting with preserved provenance | Credit Registry batch minting with attestation linkage | `credit_registry` — batch_mint node |
| Retirement finality (no resurrection) | Retirement Engine irreversible status transition | `retirement_engine` — retire node |
| Fraud prevention mechanisms | Double-spend detection, serial uniqueness | `credit_registry` — dedup_check node |

---

## Supporting Patents

### `teg-mppt-optimization` — Cluster A (HIGH)

**Filing Status:** Draft  
**Relevance:** Hardware foundation — the FPGA-based MPPT generates the power telemetry that feeds PoVCR witness submissions. Source-agnostic claims (TEG, PV, wind) support multi-source verification.

### `zero-methane-teg-integration` — Cluster A (HIGH)

**Filing Status:** Draft (CIP Ready)  
**Relevance:** Defines the ThermogenZero-specific causal chain (ZMV + incinerator + TEG) that is the first customer integration for PoVCR verification.

---

## Filed Patent References

| Patent | Filing ID | Relevance |
|--------|-----------|-----------|
| Zero Methane Facility | WO2023205756A2 / US20250270450A1 | Parent for CIP claims; establishes April 2022 priority for carbon algorithm concepts |
| Thermoelectric Generator | WO2024163685A1 | TEG hardware that generates power telemetry for PoVCR |
