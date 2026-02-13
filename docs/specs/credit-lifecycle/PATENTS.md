# Credit Lifecycle — Patent Cross-Reference

> **Spec Collection:** credit-lifecycle  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `automated-carbon-retirement` — Cluster B (MEDIUM)

**Filing Status:** Draft (Ready for filing)  
**Patent Location:** `synergythermogen/ip/patents/automated-carbon-retirement/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Trigger-based automatic retirement | Four trigger types (API, stream event, schedule, threshold) | `retirement_engine` — trigger_handler node |
| Sub-5-second latency | Real-time retirement via lex topic events | `retirement_engine` — validation + execution pipeline |
| Verified certificates with QR codes | PDF certificate generation with on-chain hash | `retirement_engine` — certificate_generator node |
| E-commerce/API integration | REST API bridge to SmartCircuit input | eStream API bridge + `retirement_engine` |

### `multi-source-carbon-aggregation` — Cluster B (MEDIUM)

**Filing Status:** Draft (CIP Ready — claims priority from WO2023205756A2, April 2022)  
**Patent Location:** `synergythermogen/ip/patents/multi-source-carbon-aggregation/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Composite credits from multiple sources | Batch minting from multi-site attestations | `credit_registry` — batch_mint node |
| Per-source verification within composite | Each attestation independently verified before aggregation | `povcr_verifier` + `credit_registry` pipeline |
| Disaggregation capability | Credit splitting with preserved provenance | `credit_registry` — split_credit node |
| Heterogeneous source support (TEG + solar + wind) | Per-tenant methodology binding | `credit_registry` — methodology_check node |

---

## Supporting Patents

### `provenance-chain` — Cluster B (HIGH)

**Filing Status:** Draft  
**Relevance:** Immutable chain of custody from issuance through retirement. The Credit Registry maintains the provenance chain; the Retirement Engine enforces retirement finality.

### `povc-carbon-credit` — Cluster B (CRITICAL)

**Filing Status:** Draft (CIP Ready)  
**Relevance:** Core verification that precedes credit minting. Every credit traces back to a PoVC attestation.
