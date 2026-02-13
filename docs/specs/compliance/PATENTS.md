# Compliance & Registry Bridge — Patent Cross-Reference

> **Spec Collection:** compliance  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `registry-bridge-system` — Cluster B (HIGH)

**Filing Status:** Draft (Internal review)  
**Patent Location:** `synergythermogen/ip/patents/registry-bridge-system/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Registry-compatible attestation packages | Dual verification output (traditional + cryptographic) | `audit_trail` — export_formatter node |
| Anti-double-counting with unique reduction IDs | Cross-registry serial check before mint | `credit_registry` — cross_registry_check node |
| Cross-reference binding | SynergyCarbon serial <-> Verra/GS serial mapping | `audit_trail` — registry_binding node |
| Dual verification (traditional + cryptographic) | Both audit log + PoVC proof in bridge package | Registry bridge service |

### `povc-verified-recs` — Cluster B (MEDIUM)

**Filing Status:** Draft (Ready for filing)  
**Patent Location:** `synergythermogen/ip/patents/povc-verified-recs/`

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Hardware-verified RECs | Extension of PoVC verification to REC generation | `povcr_verifier` — methodology: REC-specific |
| $10B+ REC market access | Marketplace supports both carbon credits and RECs | `marketplace_orderbook` — credit_type filter |
| 24/7 carbon-free energy enabler | Granular temporal matching of generation to consumption | `credit_registry` — temporal_matching node (planned) |
| REC-carbon binding | Single credit can have both carbon + REC attributes | `credit_registry` — dual_attribute support |

---

## Supporting Patents

### `provenance-chain` — Cluster B (HIGH)

**Relevance:** Audit trail IS the provenance chain. Every compliance export traces back to immutable provenance events.

### `automated-carbon-retirement` — Cluster B (MEDIUM)

**Relevance:** Retirement triggers and certificates are compliance-critical. Each retirement generates an auditable, verifiable certificate.
