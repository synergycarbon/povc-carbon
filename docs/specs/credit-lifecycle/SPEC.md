# Credit Lifecycle Specification

> **Spec Collection:** credit-lifecycle  
> **Implementation Phase:** Phase 2-3 (Weeks 7-18)  
> **SmartCircuits:** `sc.core.credit_registry.v1`, `sc.core.retirement_engine.v1`  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Sections 4, 5  
> **Patent Reference:** [PATENTS.md](PATENTS.md)

---

## 1. Overview

The credit lifecycle manages everything from minting a carbon credit NFT from a verified attestation through to its eventual retirement or cancellation. This includes the Credit Registry (issuance, tracking, transfer) and the Retirement Engine (trigger-based retirement with certificate generation).

---

## 2. Credit Registry

### 2.1 Credit Lifecycle States

```
                   Issued
                     |
          +----------+----------+
          v          v          v
       Listed     Transfer   Retired
       (market)   (direct)   (consumed)
          |
          v
        Sold --> Transfer --> Retired

   At any point:
        Cancelled  (governance action, audit failure)
```

### 2.2 Credit NFT Structure

Each carbon credit is an ERC-721-compatible NFT on eStream L2:

- `credit_id` (bytes32) — Unique ID (hash of attestation + serial)
- `project_id` (string) — Source project (e.g., "tz-wellpad-alpha-01")
- `vintage_year` (u16) — Year of emission reduction
- `credit_type` — Avoidance | Removal | Sequestration
- `methodology` (string) — Methodology ID (e.g., "EPA-AP42-CH4-FLARE")
- `tonnes_co2e` (u64) — Fixed-point, 6 decimals (1,000,000 = 1.0 tCO2e)
- `attestation_id` (bytes32) — Link to PoVCR attestation
- `merkle_root` (bytes32) — Witness Merkle root
- `owner` (bytes32) — Current owner (Spark-authenticated)
- `status` — Issued | Listed | Sold | Retired | Cancelled
- `serial_number` — Registry serial (e.g., "SC-2026-TZ-000001")

### 2.3 Visibility Tiers

Using the eStream `carbon-credit` visibility profile:

| Audience | Access | Use Case |
|----------|--------|----------|
| **public** | credit_id, tonnes_co2e, vintage, status | Anyone verifying a credit |
| **buyer** | + methodology, source_type, issuer | Due diligence before purchase |
| **auditor** | + site_location, device_ids, raw_telemetry | Third-party verification (90-day access) |
| **owner** | + cost_data, revenue, business_metrics | Credit originator internals |

### 2.4 Double-Spend Prevention

- On-chain uniqueness: each `credit_id` is a unique NFT
- Serial number registry: global sequence prevents duplicate issuance
- Retirement is irreversible
- Cross-registry check before mint (Verra/GS/CDM API)
- ZK proof: `not_double_spent` Merkle inclusion proof

---

## 3. Retirement Engine

### 3.1 Retirement Triggers

| Trigger Type | Description | Example |
|-------------|-------------|---------|
| **API call** | REST endpoint | B2B integration, e-commerce checkout |
| **Stream event** | Lex topic predicate | `order.status == 'completed'` -> retire 0.5 tCO2e |
| **Schedule** | Cron-based | Monthly retirement of accumulated credits |
| **Threshold** | Balance/cumulative trigger | Retire when balance > 100 tCO2e |

### 3.2 Retirement Flow

1. **Validation** — Credit exists, status valid, requester authorized, sufficient balance
2. **Idempotency** — Dedup key tracking (24h window)
3. **Execution** — Set status=Retired, retired_at, retired_by, reason
4. **Certificate** — PDF with QR code, on-chain record, webhook notification
5. **Emit** — Publish to `sc.retirements.completed`

### 3.3 Certificate Format

Each retirement generates a verifiable certificate containing:
- Certificate ID, quantity, vintage, project, methodology, source
- Retiring entity, timestamp, reason
- Attestation hash, Merkle root, witness quorum count
- QR code linking to on-chain verification

---

## 4. ESCIR Circuits

- **Credit Registry:** `circuits/core/credit_registry.escir.yaml`
- **Retirement Engine:** `circuits/core/retirement_engine.escir.yaml`

---

## 5. Exit Criteria

**Phase 2:**
- Credits minted from verified attestations
- Serial numbers globally unique and sequential
- Visibility tiers functioning (public/buyer/auditor/owner)
- ZK proofs verifiable for quantity and methodology

**Phase 3:**
- API-driven retirement with certificate generation
- All four trigger types functional
- PDF certificate with QR code
- Webhook delivery with retry
- End-to-end: TZ power -> witness -> attestation -> credit -> retirement -> certificate
