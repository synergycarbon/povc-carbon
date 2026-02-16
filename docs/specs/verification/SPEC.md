# Verification & Attestation Specification

> **Spec Collection:** verification  
> **Implementation Phase:** Phase 1 (Weeks 1-6)  
> **SmartCircuits:** `sc.core.povcr_verifier.v1`, `sc.core.audit_trail.v1`  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Sections 3, 10.2-10.3  
> **Patent Reference:** [PATENTS.md](PATENTS.md)  
> **ESCIR Version:** 0.8.1 — verified complete against DESIGN.md Section 3.2 pipeline (all 8 stages)

---

## 1. Overview

The verification layer is the foundation of SynergyCarbon. It accepts hardware-attested witness submissions from energy generation sites, verifies them through the PoVCR (Proof of Verified Compute Result) protocol, and produces cryptographically signed attestation records. Every credit minted on the platform traces back to a verified attestation.

---

## 2. PoVCR Protocol

### 2.1 Verification Steps

1. **Signature Check** — Verify ML-DSA-87 signature on witness frame using site's registered public key
2. **VRF Validation** — Verify the VRF proof that this site was selected as witness for this epoch
3. **Quorum Collection** — Collect witnesses from N sites for the same epoch (quorum = 3 default)
4. **Merkle Root Consensus** — Verify all quorum witnesses agree on the Merkle root (supermajority)
5. **Energy Claim Validation** — Cross-validate energy claims: `max_deviation / mean < 5%`
6. **Historical Baseline** — Compare against rolling 30-day average (flag if >20% deviation)
7. **Carbon Calculation** — Apply methodology (EPA AP-42, IPCC factors) to convert energy to tCO2e
8. **Attestation Emission** — Publish verified attestation to `sc.attestations.verified`

### 2.2 Witness Submission Format

Witness submissions arrive from tenant carbon minter circuits (e.g., `tz.cloud.carbon_minter.v1`) as typed ESF frames on lex topics:

- **Input topic:** `sc.witnesses.submission`
- **Output topics:** `sc.attestations.verified`, `sc.attestations.rejected`

### 2.3 Failure Modes

| Failure | Detection | Action |
|---------|-----------|--------|
| Invalid signature | Step 1 | Reject witness, log to `sc.attestations.rejected` |
| Invalid VRF proof | Step 2 | Reject witness |
| Quorum timeout (5 min) | Step 3 | Defer to next epoch, flag site connectivity |
| Merkle root disagreement | Step 4 | Reject epoch, trigger investigation |
| Energy claim >5% deviation | Step 5 | Flag for manual review, mint at lowest claim |
| >20% deviation from baseline | Step 6 | Pause auto-mint, require auditor approval |
| Methodology error | Step 7 | Reject, flag misconfiguration |

### 2.4 Supported Methodologies

| ID | Methodology | Source Types | Carbon Calculation |
|----|-------------|-------------|-------------------|
| `EPA-AP42-CH4-FLARE` | EPA AP-42 methane flare avoidance | TEG, gas-to-power | CH4 mass x GWP factor |
| `IPCC-AR5-100Y` | IPCC AR5 100-year GWP | All | Standard GWP = 28 for CH4 |
| `IPCC-AR5-20Y` | IPCC AR5 20-year GWP | All | Standard GWP = 84 for CH4 |
| `VCS-AMS-III-H` | Verra AMS-III.H (methane recovery) | Methane capture | Verra-specific calculation |
| `GS-MICRO-SCALE` | Gold Standard micro-scale | Small generators | Gold Standard formula |
| `CDM-ACM0001` | CDM flare gas recovery | Flare gas | CDM-specific formula |
| `CUSTOM` | Custom (requires auditor approval) | Any | Tenant-defined |

---

## 3. Governance Foundation

### 3.1 Methodology Registry

New methodologies require governance approval (see [compliance/ spec](../compliance/SPEC.md)):

1. Formal proposal with calculation formula
2. Third-party auditor review
3. Governance vote (>66% approval)
4. Test period (90 days, capped volume)
5. Full approval

### 3.2 Verifier Key Registry

Sites register ML-DSA-87 public keys via governance:

1. Site submits key registration request
2. Hardware attestation (T0/TSSP device proof)
3. Physical site verification (auditor visit or remote)
4. Governance approval
5. Key added to verifier registry at `sc.governance.verifier.registered`

---

## 4. Platform Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| ML-DSA-87 verification | Available (v0.8.1) | PQ crypto primitives |
| VRF verification | Available (v0.8.1) | VRF engine in crypto module |
| `esf-carbon` CarbonAttestation schema | Available | Wire format for attestations |
| StreamSight telemetry | Available (v0.8.1) | Observability |
| TZ `carbon_minter.v1` circuit | Complete | Produces witness submissions |

---

## 5. ESCIR Circuit

**Circuit file:** `circuits/core/povcr_verifier.escir.yaml`

See [DESIGN.md Section 3](../../DESIGN.md#3-povcr-protocol) for the complete protocol specification and [IMPLEMENTATION_PLAN.md Phase 1](../../IMPLEMENTATION_PLAN.md#2-phase-1--povcr-verifier--audit-trail-weeks-16) for build tasks.

---

## 6. Exit Criteria

- PoVCR Verifier accepts TZ witnesses and produces verified attestations
- Audit trail captures all verification events
- EPA AP-42 methodology implemented and validated
- End-to-end test: TZ edge -> TZ cloud minter -> SC verifier -> attestation
- 10 simulated witness epochs processed correctly
