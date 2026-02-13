# Compliance & Registry Bridge Specification

> **Spec Collection:** compliance  
> **Implementation Phase:** Cross-cutting (Phases 1-6), enhanced in Phase 6  
> **SmartCircuits:** `sc.core.audit_trail.v1`  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Sections 7, 8  
> **Patent Reference:** [PATENTS.md](PATENTS.md)

---

## 1. Overview

Compliance is cross-cutting: the audit trail is active from Phase 1, the B2B API in Phase 3, and the registry bridge and governance in Phase 6. This spec covers audit trail requirements, regulatory export, third-party auditor access, and the bridge to traditional carbon registries.

---

## 2. Audit Trail

### 2.1 Requirements

Every operation logged to `sc.audit.events` with:
- Timestamp (microsecond precision)
- Actor (Spark-authenticated identity)
- Action (issue, transfer, retire, list, cancel)
- Subject (credit_id or attestation_id)
- Details (before/after state)
- Signature (ML-DSA-87 signed event)

### 2.2 Retention

10-year default retention, configurable per event type.

### 2.3 Regulatory Export

| Standard | Format | Frequency | Audience |
|----------|--------|-----------|----------|
| GHG Protocol | XLSX/CSV | Annual | Corporate reporters |
| Verra VCS | VCS Registry API | Per-issuance | Registry operators |
| Gold Standard | GS Registry API | Per-issuance | Registry operators |
| ISCC | ISCC-compliant JSON | Quarterly | Certification bodies |
| SOC2 | Structured audit log | Continuous | Auditors |

---

## 3. Third-Party Auditor Access

Auditors authenticate via Spark and receive time-limited (90-day) elevated access:
- Site-level telemetry samples
- Device identifiers and hardware specs
- Raw Merkle proofs and witness data
- Methodology calculation breakdown
- Access is logged and revocable

---

## 4. Registry Bridge (Phase 6)

Bridge PoVC-verified credits to traditional registries (Verra, Gold Standard, ACR, CAR):

- Registry-compatible attestation packages
- Dual verification: traditional audit trail + cryptographic proof
- Anti-double-counting with unique reduction IDs
- Cross-reference binding (SynergyCarbon serial <-> registry serial)

---

## 5. B2B Integration API

REST API via eStream API bridge (Phase 3):

```
POST   /api/v1/credits/retire
GET    /api/v1/credits/{id}
GET    /api/v1/credits
POST   /api/v1/credits/verify
GET    /api/v1/retirements
GET    /api/v1/retirements/{id}
POST   /api/v1/marketplace/list
GET    /api/v1/marketplace/search
POST   /api/v1/marketplace/buy
POST   /api/v1/triggers
GET    /api/v1/impact/{entity_id}
GET    /api/v1/audit/export
```

Authentication: Spark (write operations), API Key (B2B automation), OAuth2 (third-party apps).

---

## 6. Governance (Phase 6)

### 6.1 Platform Parameters

| Parameter | Default | Change Mechanism |
|-----------|---------|-----------------|
| Quorum size | 3 witnesses | Proposal + vote |
| GWP factor | 28 (IPCC AR5) | Proposal + vote |
| Verification discount | 5% conservative | Proposal + vote |
| Listing fee | 0.5% of sale | Proposal + vote |
| Retirement fee | $0.10 | Proposal + vote |

### 6.2 Methodology Approval

New methodologies: proposal -> auditor review -> governance vote (>66%) -> 90-day test period -> full approval.

### 6.3 Verifier Registration

Site key registration: submit -> hardware attestation -> site verification -> governance approval.

---

## 7. ESCIR Circuit

**Circuit file:** `circuits/core/audit_trail.escir.yaml`

---

## 8. Exit Criteria

- Audit trail capturing all platform events from Phase 1 onward
- GHG Protocol export validated
- Auditor time-limited access functional
- Registry bridge operational for at least Verra VCS
- Governance voting functional for methodology and parameters
