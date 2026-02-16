# SynergyCarbon Spec Collections

> **Version:** 1.1.0
> **Date:** 2026-02-15
> **Platform:** eStream v0.8.1 + Console Kit (`@estream/sdk-browser/widgets`)
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md) (22 patents across 4 clusters)

---

## Overview

Spec collections organize SynergyCarbon platform features into self-contained units that map to patent clusters, implementation phases, and feature lifecycles. Each collection contains:

- **SPEC.md** — Technical specification for the feature area
- **PATENTS.md** — Patent cross-references with claim-to-feature mapping and filing status

The master design narrative lives in [DESIGN.md](../DESIGN.md) and [AI_FORWARD_CONTRACTS_SPEC.md](../AI_FORWARD_CONTRACTS_SPEC.md). These spec collections are the structured reference view.

---

## Collections

| Collection | Description | Patents | Impl Phase | Status |
|-----------|-------------|---------|------------|--------|
| [verification/](verification/) | PoVCR protocol, witness verification, attestation | povc-carbon-credit, provenance-chain | Phase 1 (Wk 1-6) | Spec Ready |
| [credit-lifecycle/](credit-lifecycle/) | Credit Registry, NFT minting, retirement engine | automated-carbon-retirement, multi-source-carbon-aggregation | Phase 2-3 (Wk 7-18) | Spec Ready |
| [marketplace/](marketplace/) | Order book, trading, spot settlement | smartcircuit-carbon-marketplace | Phase 4 (Wk 19-24) | Spec Ready |
| [ai-forecasting/](ai-forecasting/) | AI yield forecaster, forward pricing oracle | ai-carbon-yield-forecasting, carbon-forward-pricing-oracle | Phase 7 (Wk 37-44) | Spec Ready |
| [forward-contracts/](forward-contracts/) | Forward contract engine, settlement, escrow | forward-carbon-credit-contracts, streaming-carbon-settlement | Phase 7 (Wk 37-44) | Spec Ready |
| [compliance/](compliance/) | Registry bridge, audit trail, regulatory export | registry-bridge-system, povc-verified-recs | Phase 1-6 (cross-cutting) | Spec Ready |
| [source-adapters/](source-adapters/) | Universal witness node, per-source methodology plugins | universal-carbon-witness-node, biogas, CCS, grid-displacement, nature-based | Phase 9 (Wk 53-60) | Spec Ready |
| [marketplace-ui/](marketplace-ui/) | Console Kit deployment, widget catalog, branding | — | Phase 8 (Wk 45-52) | Spec Ready |
| [governance/](governance/) | Platform governance, methodology approval, verifier registration | — | Phase 6 (cross-cutting) | Planned |
| [rbac/](rbac/) | RBAC & Data Gateway, visibility tier mapping, Spark action gates | — | Phase 8 (cross-cutting) | Planned |
| [b2b-api/](b2b-api/) | B2B REST API (edge proxy), webhooks, OpenAPI spec | — | Phase 3 (Wk 13-18) | Planned |

---

## Patent Mapping

### Filed Patents (in `patents-filed/`)

| Patent | Filing ID | Spec Collection |
|--------|-----------|----------------|
| Zero Methane Facility | WO2023205756A2 / US20250270450A1 | (parent — referenced by CIPs) |
| Thermoelectric Generator | WO2024163685A1 | (hardware — referenced in verification/) |

### Cluster A: Hardware & Thermal (6 patents, all Draft)

| Patent | Spec Collection | Priority |
|--------|----------------|----------|
| teg-mppt-optimization | verification/ (hardware foundation) | HIGH |
| modular-containerized-teg-plant | source-adapters/ | HIGH |
| thermoelectric-black-start | source-adapters/ | HIGH |
| geothermal-cooled-teg | source-adapters/ | MEDIUM |
| hybrid-heat-source-teg | source-adapters/ | MEDIUM |
| zero-methane-teg-integration | verification/ | HIGH |

### Cluster B: Carbon Verification (6 patents, all Draft)

| Patent | Spec Collection | Priority |
|--------|----------------|----------|
| povc-carbon-credit | verification/ | CRITICAL |
| provenance-chain | verification/ | HIGH |
| registry-bridge-system | compliance/ | HIGH |
| automated-carbon-retirement | credit-lifecycle/ | MEDIUM |
| multi-source-carbon-aggregation | credit-lifecycle/ | MEDIUM |
| povc-verified-recs | compliance/ | MEDIUM |

### Cluster C: AI & Financial Innovation (5 patents, all Draft — New)

| Patent | Spec Collection | Priority |
|--------|----------------|----------|
| ai-carbon-yield-forecasting | ai-forecasting/ | HIGH |
| forward-carbon-credit-contracts | forward-contracts/ | HIGH |
| carbon-forward-pricing-oracle | ai-forecasting/ | MEDIUM |
| streaming-carbon-settlement | forward-contracts/ | MEDIUM |
| smartcircuit-carbon-marketplace | marketplace/ | MEDIUM |

### Cluster D: Market Expansion (5 patents, all Draft — New)

| Patent | Spec Collection | Priority |
|--------|----------------|----------|
| universal-carbon-witness-node | source-adapters/ | CRITICAL |
| biogas-povc-attestation | source-adapters/ | HIGH |
| ccs-sequestration-verification | source-adapters/ | HIGH |
| grid-displacement-carbon-methodology | source-adapters/ | MEDIUM |
| nature-based-carbon-sensing | source-adapters/ | MEDIUM |

---

## Implementation Phase Mapping

```
Phase 1  (Wk  1-6)   verification/ + compliance/       Core PoVCR + audit trail
Phase 2  (Wk  7-12)  credit-lifecycle/                  Credit Registry + NFT mint
Phase 3  (Wk 13-18)  credit-lifecycle/ + compliance/    Retirement + B2B API
Phase 4  (Wk 19-24)  marketplace/                       Spot marketplace + trading
Phase 5  (Wk 25-30)  marketplace-ui/ (impact widgets)   Impact widget + dashboard
Phase 6  (Wk 31-36)  compliance/ + source-adapters/     Governance + multi-tenant
Phase 7  (Wk 37-44)  ai-forecasting/ + forward-contracts/  AI + forward contracts
Phase 8  (Wk 45-52)  marketplace-ui/                    Marketplace UI + marketing site
Phase 9  (Wk 53-60)  source-adapters/                   Solar, biogas, CCS onboarding
```

---

## Cross-References

| Document | Location | Purpose |
|----------|----------|---------|
| [DESIGN.md](../DESIGN.md) | povc-carbon/docs/ | Master platform design (narrative) |
| [AI_FORWARD_CONTRACTS_SPEC.md](../AI_FORWARD_CONTRACTS_SPEC.md) | povc-carbon/docs/ | AI + forward contracts detailed spec |
| [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) | povc-carbon/docs/ | Phased build plan (9 phases) |
| [PORTFOLIO-REVIEW.md](../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md) | synergythermogen/ip/patents/ | Patent portfolio (22 patents) |
