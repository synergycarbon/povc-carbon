# SC-SPEC-002: Credit Registry

> **Status**: Draft
> **Version**: 2.0.0
> **Date**: 2026-02-20
> **Scope**: Credit lifecycle, per-project sub-lex with fan-in, vintage tracking, account management, provenance chain
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)
> **Compliance**: EPA GHG, ISO 14064, Verra VCS, Gold Standard

---

## 1. Overview

The Credit Registry is the authoritative record of all carbon credits issued, transferred, and retired on SynergyCarbon. Each credit is backed by a verified PoVCR attestation chain (SC-SPEC-001) and carries full cryptographic provenance — from the hardware sensor that measured the reduction to the retirement certificate that counts the offset.

Credits are NFT-like digital assets: unique, individually traceable, and permanently linked to their source project, vintage year, and methodology. The registry enforces that no credit can be double-counted, double-retired, or transferred without compliance checks.

---

## 2. Credit Lifecycle

```
PENDING → ISSUED → ACTIVE → TRANSFERRED → RETIRED
                     ↑          │
                     └──────────┘  (re-ACTIVE after transfer to new holder)
```

### 2.1 State Definitions

| State | Description | Transitions |
|-------|-------------|-------------|
| `PENDING` | Verification complete, awaiting issuance batch | → ISSUED |
| `ISSUED` | Credit minted, assigned to project developer account | → ACTIVE |
| `ACTIVE` | Credit available for trading or retirement | → TRANSFERRED, → RETIRED |
| `TRANSFERRED` | Ownership moved to new account (credit becomes ACTIVE under new holder) | → ACTIVE (new holder) |
| `RETIRED` | Permanently removed from circulation, offset counted | Terminal state |

### 2.2 Transition Rules

- **PENDING → ISSUED**: Requires verified PoVCR batch reference, methodology match, and registry admin approval (automated for standard methodologies)
- **ISSUED → ACTIVE**: Automatic after issuance confirmation and account assignment
- **ACTIVE → TRANSFERRED**: Requires compliance check (both accounts verified), transaction primitive with reserve/debit/credit
- **ACTIVE → RETIRED**: Requires retirement request from account holder, generates retirement certificate
- No backward transitions. A RETIRED credit cannot be un-retired.

---

## 3. Credit Issuance

### 3.1 Minting

When a PoVCR batch achieves `VERIFIED` status, the registry mints credits:

```
Credit {
  credit_id        : UUID v7
  project_id       : string
  vintage_year     : uint16             # Year the reduction occurred
  tonnes_co2e      : float64            # Quantity in metric tonnes CO2 equivalent
  methodology      : string             # e.g. "VM0006-v1.2"
  verification_ref : bytes(32)          # Hash of VerificationResult batch
  merkle_proof     : bytes[]            # Proof linking to attestation chain
  issued_to        : account_id
  issued_at        : uint64             # Unix epoch ms
  state            : CreditState
  signature        : ML-DSA-87          # Registry signing key
}
```

### 3.2 Issuance Constraints

- One credit per verified reduction unit (no fractional minting; minimum 1 tCO2e)
- Vintage year derived from the attestation timestamps in the source batch
- Duplicate detection: `SHA3-256(project_id || epoch_id || methodology)` must be unique
- Issuance rate capped at methodology-defined maximum annual capacity

---

## 4. Transfer

Transfers use the eStream transaction primitive to ensure atomicity:

1. **Reserve**: Credit locked in sender's account (state remains ACTIVE, but flagged `RESERVED`)
2. **Compliance check**: Both sender and receiver accounts are verified (KYC/KYB complete, no sanctions flags)
3. **Debit**: Credit removed from sender's account
4. **Credit**: Credit assigned to receiver's account, state returns to ACTIVE

```
TransferRecord {
  transfer_id      : UUID v7
  credit_id        : UUID v7
  from_account     : account_id
  to_account       : account_id
  timestamp        : uint64
  compliance_hash  : bytes(32)          # Hash of compliance check result
  signature        : ML-DSA-87          # Registry co-signature
}
```

Failed compliance checks abort the transaction and release the reservation. All transfer attempts (successful and failed) are recorded in the audit trail.

---

## 5. Retirement

Retirement permanently removes a credit from circulation:

```
RetirementEvent {
  retirement_id    : UUID v7
  credit_id        : UUID v7
  retired_by       : account_id
  beneficiary      : string             # Entity claiming the offset
  purpose          : string             # e.g. "2025 Scope 2 offset"
  timestamp        : uint64
  certificate_hash : bytes(32)          # Hash of generated retirement certificate
  signature        : ML-DSA-87
}
```

### 5.1 Retirement Certificate

A human-readable PDF and machine-readable JSON certificate are generated containing:
- Credit provenance chain (project → attestation → verification → issuance → retirement)
- Merkle proof linking retirement to original hardware measurement
- QR code with verification URL
- ML-DSA-87 signature for certificate authenticity

### 5.2 Offset Accounting

Retired credits increment the beneficiary's cumulative offset counter. This counter is a monotonically increasing aggregate — it can never decrease.

---

## 6. Per-Project Sub-Lex and Fan-In

### 6.1 Data Isolation

Raw sensor data and individual attestations stay within the project-level lex:

```
esn/sustainability/carbon/org/synergycarbon/
  project/{project_id}/
    credits/
      issued/              # Credit records
      transfers/           # Transfer history
      retirements/         # Retirement events
      certificates/        # Retirement certificates
```

### 6.2 Fan-Up Rules

Only aggregated, non-sensitive data fans up to the registry level:

| Project-Level Data | Registry-Level Aggregate |
|-------------------|--------------------------|
| Individual credit records | `CREDIT_TOTAL` (count + tonnes by vintage) |
| Verification results | `VERIFIED_DATA` (total verified tonnes, compliance hash) |
| Transfer records | `TRANSFER_VOLUME` (aggregate daily/monthly) |
| Retirement events | `RETIREMENT_TOTAL` (aggregate by beneficiary) |

Raw attestation data, sensor readings, and location hashes **never** fan up.

---

## 7. Vintage Tracking

Credits are grouped by vintage year for market pricing and compliance reporting:

```
VintageYear {
  year             : uint16
  project_id       : string
  total_issued     : float64            # tCO2e
  total_active     : float64
  total_retired    : float64
  avg_price        : float64            # Last 30-day weighted average
  methodology      : string
}
```

Vintage year is immutable once assigned. Market pricing typically discounts older vintages (see SC-SPEC-003 for marketplace pricing).

---

## 8. Account Management

### 8.1 Account Types

| Type | Description | Capabilities |
|------|-------------|-------------|
| `PROJECT_DEVELOPER` | Entity that generates credits from verified reductions | Receive issuance, transfer, retire |
| `BUYER` | Entity that purchases credits for offset | Receive transfer, retire |
| `BROKER` | Intermediary facilitating trades | Transfer (in and out), no retirement |
| `REGISTRY_ADMIN` | Platform operator | Issuance approval, account management, governance |

### 8.2 Account Verification

All accounts require:
- KYC (individuals) or KYB (organizations) completion
- OFAC/sanctions screening (updated daily)
- ML-DSA-87 key pair generation via SPARK ceremony
- Acceptance of registry terms of service

---

## 9. Registry Analytics

Aggregate metrics computed from registry data and exposed via the operator console:

| Metric | Description |
|--------|-------------|
| `total_tonnes_verified` | Cumulative verified tCO2e across all projects |
| `credits_active` | Currently circulating credits (issued − retired − reserved) |
| `retirement_rate` | Monthly retirement volume / active credits |
| `projects_active` | Projects with at least one ACTIVE credit |
| `compliance_hash` | Rolling SHA3-256 of all registry state transitions |
| `transfer_velocity` | Average transfers per credit per month |

---

## 10. Graph Model — credit_registry

### 10.1 Node Types

| Node | Description | Key Fields |
|------|-------------|------------|
| `Credit` | Individual carbon credit | credit_id, tonnes_co2e, vintage_year, state |
| `Account` | Participant in the registry | account_id, account_type, verified |
| `RetirementEvent` | Permanent credit removal record | retirement_id, beneficiary, certificate_hash |
| `VintageYear` | Aggregation bucket for credits by year | year, project_id, total_issued |

### 10.2 Edge Types

| Edge | From → To | Semantics |
|------|-----------|-----------|
| `issued_by` | Credit → Account (PROJECT_DEVELOPER) | Credit origin |
| `held_by` | Credit → Account | Current holder |
| `transferred_to` | Credit → Account | Transfer destination (creates new `held_by`) |
| `retired_by` | Credit → RetirementEvent | Retirement action |

### 10.3 Overlays

| Overlay | Scope | Description |
|---------|-------|-------------|
| `total_tonnes_verified` | Registry-wide | Running total of verified reductions |
| `credits_active` | Per-project or registry-wide | Active credit count |
| `retirement_rate` | Per-project | Rolling 30-day retirement percentage |

### 10.4 Series

**`credit_provenance`**
- Append-only series with Merkle-chaining
- Each entry: `{ credit_id, event_type, from_account, to_account, timestamp, merkle_proof }`
- Full lifecycle of every credit from issuance to retirement
- PoVC imprint: co-signed by registry ML-DSA-87 key

---

## 11. Security Considerations

- **Double-count prevention**: Credit IDs are globally unique; the `SHA3-256(project_id || epoch_id || methodology)` uniqueness constraint prevents re-minting
- **Double-retirement prevention**: Retirement transitions are terminal and enforced at the state machine level
- **Transfer atomicity**: eStream transaction primitive ensures no partial transfers
- **Audit immutability**: All state transitions are Merkle-chained; retroactive modification is detectable
- **Quantum resistance**: All registry signatures use ML-DSA-87

---

## References

- [SC-SPEC-001](SC-SPEC-001-verification-pipeline.md) — Verification Pipeline (produces verified batches)
- [SC-SPEC-003](SC-SPEC-003-marketplace.md) — Marketplace (trades ACTIVE credits)
- [SC-SPEC-004](SC-SPEC-004-governance.md) — Governance (methodology and account policies)
- [DESIGN.md](../DESIGN.md) — Platform design narrative
- Verra VCS Registry Terms of Use
- ISO 14064-2:2019 — Project-level GHG quantification
