# SynergyCarbon PoVC-Carbon — Implementation Plan

> **Version:** 2.0.0  
> **Date:** 2026-02-11  
> **Status:** Draft  
> **Platform:** eStream v0.8.1  
> **First Customer:** ThermogenZero (thermoelectric microgrid)  
> **Design Reference:** [DESIGN.md](DESIGN.md)  
> **Spec Collections:** [specs/INDEX.md](specs/INDEX.md)  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## 1. Implementation Overview

This plan builds the SynergyCarbon platform in 9 phases over 60 weeks. Each phase delivers a deployable increment. The platform is built entirely on eStream SmartCircuits, with the `esf-carbon` schema pack as the wire format and the `carbon-credit` visibility profile controlling access.

### Dependency Chain

```
Phase 1 (Wk  1-6):  PoVCR Verifier + Audit Trail ──→ Core verification layer
    │                Spec: verification/, compliance/
Phase 2 (Wk  7-12): Credit Registry + NFT Mint ──→ Credit issuance
    │                Spec: credit-lifecycle/
Phase 3 (Wk 13-18): Retirement Engine + API ──→ B2B consumption
    │                Spec: credit-lifecycle/, compliance/
Phase 4 (Wk 19-24): Marketplace + Trading ──→ Secondary market
    │                Spec: marketplace/
Phase 5 (Wk 25-30): Impact Widget + Dashboard ──→ Enterprise visibility
    │                Spec: marketplace-ui/ (impact widgets)
Phase 6 (Wk 31-36): Governance + Multi-tenant ──→ Scale beyond TZ
    │                Spec: compliance/, source-adapters/
Phase 7 (Wk 37-44): AI Forecasting + Forward Contracts ──→ Intelligence layer
    │                Spec: ai-forecasting/, forward-contracts/
Phase 8 (Wk 45-52): Marketplace UI + Marketing Site ──→ Consumer experience
    │                Spec: marketplace-ui/
Phase 9 (Wk 53-60): Source Adapters ──→ Multi-market expansion
                     Spec: source-adapters/
```

---

## 2. Phase 1 — PoVCR Verifier & Audit Trail (Weeks 1–6)

**Goal:** Accept PoVC witnesses from ThermogenZero, verify them, and produce attestation records.

### 2.1 PoVCR Verifier SmartCircuit

**ESCIR:** `circuits/core/povcr_verifier.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit with I/O streams | Inputs: `sc.witnesses.submission`, Outputs: `sc.attestations.verified`, `sc.attestations.rejected` | 1 |
| Implement ML-DSA-87 signature verification | Use eStream PQ crypto primitives | 1–2 |
| Implement VRF proof validation | Verify witness selection proof | 2 |
| Build quorum collector | Configurable quorum_size (default 3), quorum_window (5 min) | 2–3 |
| Implement Merkle root consensus | Supermajority agreement on root hash | 3 |
| Energy claim cross-validation | Max deviation / mean < 5% check | 3 |
| Historical baseline comparison | Rolling 30-day average, flag >20% deviation | 4 |
| Carbon calculation engine | Pluggable methodology support (EPA AP-42 first) | 4–5 |
| Attestation record builder | Produce `CarbonAttestation` ESF frames | 5 |
| Integration test with TZ `carbon_minter` circuit | End-to-end: TZ witness → SC attestation | 5–6 |

### 2.2 Audit Trail SmartCircuit

**ESCIR:** `circuits/core/audit_trail.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit | Inputs: all `sc.*` topics, Output: `sc.audit.events` | 1 |
| Event schema definition | Actor, action, subject, before/after, signature | 1 |
| ML-DSA-87 event signing | Sign each audit event for tamper evidence | 2 |
| Retention policy engine | 10-year default, configurable per event type | 2 |
| Query interface | Filter by actor, action, subject, time range | 3 |
| Regulatory export (GHG Protocol) | XLSX/CSV export with GHG Protocol fields | 3–4 |

### 2.3 Governance Foundation

| Task | Details | Week |
|------|---------|------|
| Methodology registry | Store approved methodologies in `sc.governance.methodology.approved` | 4 |
| Verifier key registry | Store registered site public keys in `sc.governance.verifier.registered` | 4 |
| Platform parameters | Quorum size, GWP factor, thresholds in `sc.governance.parameters` | 5 |

### 2.4 eStream Platform Dependencies (Phase 1)

| Dependency | Status | Notes |
|-----------|--------|-------|
| ML-DSA-87 verification in estream-kernel | Available (v0.8.1) | PQ crypto primitives |
| VRF verification | Available (v0.8.1) | VRF engine in crypto module |
| `esf-carbon` CarbonAttestation schema | Available (marketplace spec) | Wire format for attestations |
| StreamSight telemetry | Available (v0.8.1) | Observability |
| TZ `carbon_minter.v1` circuit | Complete (TZ integration plan) | Produces witness submissions |

### Phase 1 Exit Criteria

- [ ] PoVCR Verifier accepts TZ witnesses and produces verified attestations
- [ ] Audit trail captures all verification events
- [ ] EPA AP-42 methodology implemented and validated
- [ ] End-to-end test: TZ edge → TZ cloud minter → SC verifier → attestation
- [ ] 10 simulated witness epochs processed correctly

---

## 3. Phase 2 — Credit Registry & NFT Minting (Weeks 7–12)

**Goal:** Mint carbon credit NFTs from verified attestations.

### 3.1 Credit Registry SmartCircuit

**ESCIR:** `circuits/core/credit_registry.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit | Inputs: `sc.attestations.verified`, Outputs: `sc.credits.*` | 7 |
| Credit NFT data model | ERC-721 compatible fields per DESIGN.md Section 4.2 | 7 |
| Serial number generator | Sequential global serial: `SC-{year}-{project}-{seq}` | 7 |
| Mint pipeline | Attestation → carbon calculation → credit NFT creation | 7–8 |
| Duplicate detection | Check serial number uniqueness, attestation dedup | 8 |
| Credit state machine | Issued → Listed/Transferred/Retired, Cancelled from any state | 8–9 |
| Ownership tracking | Spark-authenticated owner field, transfer with signature | 9 |
| Batch minting | Mint multiple credits from multi-site attestations | 9–10 |
| ESF frame encoding | `CarbonCredit` and `CarbonMint` ESF frames | 10 |
| StreamSight integration | Emit to `sc.credits.issued`, counters for total minted/tCO2e | 10 |

### 3.2 Visibility Integration

| Task | Details | Week |
|------|---------|------|
| Apply `carbon-credit` visibility profile | Wire up audience-based field filtering | 10 |
| ZK proof generation | `quantity_positive`, `methodology_valid`, `not_double_spent` | 10–11 |
| Auditor time-limited access | 90-day scoped access with auto-expiry | 11 |

### 3.3 eStream Platform Dependencies (Phase 2)

| Dependency | Status | Notes |
|-----------|--------|-------|
| NFT mint primitive | Available (platform circuit) | L2 NFT minting |
| `esf-carbon` CarbonCredit + CarbonMint schemas | Available (marketplace spec) | Wire format |
| `carbon-credit` visibility profile | Available (estream-io) | Tiered access control |
| Bulletproofs (ZK range proofs) | Available (v0.8.1) | For `quantity_positive` |
| Groth16 (ZK set membership) | Available (v0.8.1) | For `methodology_valid` |

### Phase 2 Exit Criteria

- [ ] Credits minted from verified attestations
- [ ] Serial numbers globally unique and sequential
- [ ] Visibility tiers functioning (public/buyer/auditor/owner)
- [ ] ZK proofs verifiable for quantity and methodology
- [ ] Batch mint tested with multi-site quorum

---

## 4. Phase 3 — Retirement Engine & B2B API (Weeks 13–18)

**Goal:** Enable programmatic credit retirement with certificate generation.

### 4.1 Retirement Engine SmartCircuit

**ESCIR:** `circuits/core/retirement_engine.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit | Inputs: `sc.retirements.requested`, Outputs: `sc.retirements.completed` | 13 |
| Retirement validation | Credit exists, status valid, requester authorized, balance check | 13 |
| Idempotency service | Dedup key tracking, 24h window | 13 |
| Status transition | Set status=Retired, retired_at, retired_by, reason | 14 |
| Certificate generator | PDF rendering with QR code, branding, provenance data | 14–15 |
| On-chain record | Immutable retirement record on eStream L2 | 15 |
| API trigger handler | `POST /api/v1/credits/retire` → SmartCircuit input | 15 |
| Stream event trigger | Lex topic predicate → automatic retirement | 16 |
| Schedule trigger | Cron-based periodic retirement | 16 |
| Threshold trigger | Balance/cumulative trigger → retirement | 16–17 |
| Webhook dispatcher | Notify clients on retirement completion | 17 |
| Retry + dead-letter queue | Exponential backoff, failed retirements queue | 17 |

### 4.2 REST API Layer

| Task | Details | Week |
|------|---------|------|
| API gateway setup | Route to SmartCircuit inputs via eStream API bridge | 13 |
| Authentication (Spark + API key) | Spark for direct, API key for B2B automation | 14 |
| `/api/v1/credits/*` endpoints | CRUD + verify + list (filtered) | 14–15 |
| `/api/v1/retirements/*` endpoints | List, get + certificate, retirement history | 15 |
| `/api/v1/triggers/*` endpoints | Create, list, delete retirement triggers | 16 |
| `/api/v1/impact/{entity}` endpoint | Impact summary for widget | 16 |
| Rate limiting & quotas | Per-API-key rate limits, tier-based quotas | 17 |
| OpenAPI spec | Full OpenAPI 3.1 specification | 17 |
| SDK generation (TypeScript, Python) | Auto-generated from OpenAPI | 18 |

### 4.3 eStream Platform Dependencies (Phase 3)

| Dependency | Status | Notes |
|-----------|--------|-------|
| eStream API bridge | Available (v0.8.1) | REST → SmartCircuit mapping |
| Spark authentication | Available (v0.8.1) | PQ-authenticated identity |
| Webhook infra | Needs implementation | Build on eStream event system |

### Phase 3 Exit Criteria

- [ ] API-driven retirement: request → validate → retire → certificate
- [ ] All four trigger types functional (API, stream, schedule, threshold)
- [ ] PDF certificate generation with QR code
- [ ] Webhook delivery with retry
- [ ] OpenAPI spec published, SDKs generated
- [ ] End-to-end: TZ power generation → witness → attestation → credit → retirement → certificate

---

## 5. Phase 4 — Marketplace & Trading (Weeks 19–24)

**Goal:** Enable listing, discovery, and purchase of carbon credits.

### 5.1 Marketplace SmartCircuit

**ESCIR:** `circuits/marketplace/orderbook.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit | Inputs: `sc.marketplace.orders`, Outputs: `sc.marketplace.listings.*` | 19 |
| Listing creation | Owner lists credits with price, min_purchase, expiration | 19 |
| Listing discovery | Filter by vintage, type, methodology, price, source | 19–20 |
| Order matching | Simple ask-price matching (not full orderbook initially) | 20 |
| Escrow service | Lock buyer funds in eStream payment channel | 20–21 |
| Settlement | Transfer credit, release funds, both parties notified | 21 |
| Batch listing | List multiple credits as a bundle | 21 |
| Listing expiration | Auto-expire listings past expiration date | 22 |
| Market data aggregation | Pricing, volume, trends to `sc.marketplace.market_data` | 22 |
| Listing fee collection | 0.5% of sale to platform treasury | 22 |

### 5.2 Console UI (estream-app integration)

| Task | Details | Week |
|------|---------|------|
| Credit management view | List owned credits, status, provenance | 22 |
| Marketplace browse view | Search, filter, sort listings | 22–23 |
| Buy flow | Select → review → confirm → settlement | 23 |
| Retirement view | History, certificates, impact summary | 23 |
| Portfolio analytics | tCO2e over time, vintage distribution, cost basis | 23–24 |
| TZ-specific dashboard | ThermogenZero fleet view → credits generated | 24 |

### Phase 4 Exit Criteria

- [ ] Credits can be listed, discovered, purchased, and settled
- [ ] Escrow protects both buyer and seller
- [ ] Market data published in real-time
- [ ] Console UI for credit management and marketplace
- [ ] Listing fees collected correctly

---

## 6. Phase 5 — Impact Widget & Dashboard (Weeks 25–30)

**Goal:** Embeddable widgets for enterprise impact display.

### 6.1 Impact Widget SmartCircuit

**ESCIR:** `circuits/marketplace/impact_widget.escir.yaml`

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit | Inputs: `sc.retirements.completed`, Outputs: `sc.impact.{entity}` | 25 |
| Entity impact aggregation | Sum retired tCO2e by entity, project, time period | 25 |
| Counter variant | Running total with count-up animation | 25–26 |
| Certificate variant | Visual retirement certificate display | 26 |
| Live meter variant | Real-time generation/avoidance from tenant stream | 26–27 |
| Leaderboard variant | Multi-entity comparison | 27 |
| WebSocket real-time feed | < 1s latency from retirement to widget update | 27 |

### 6.2 Embedding

| Task | Details | Week |
|------|---------|------|
| iframe embed | Hosted page at `sc.estream.dev/widget/{variant}/{entity}` | 27 |
| React npm package | `@synergycarbon/impact-widget` | 28 |
| Vanilla JS bundle | Standalone script, no dependencies | 28 |
| Theming/branding | Configurable logo, colors, fonts, layout | 28–29 |
| i18n | Multi-language support | 29 |
| Responsive + accessible | Mobile-friendly, WCAG 2.1 AA | 29–30 |

### 6.3 Carbon Analytics Dashboard

| Task | Details | Week |
|------|---------|------|
| Fleet-level analytics | Total tCO2e by project, by time | 29 |
| Methodology breakdown | Credits by methodology, vintage distribution | 29 |
| Retirement trends | Retirement rate, buyer demographics, trigger types | 30 |
| Projection engine | 30/90/365-day projections from historical data | 30 |

### Phase 5 Exit Criteria

- [ ] All 4 widget variants functional and embeddable
- [ ] Real-time updates via WebSocket (< 1s)
- [ ] React + vanilla JS + iframe all working
- [ ] WCAG 2.1 AA compliant
- [ ] Analytics dashboard deployed

---

## 7. Phase 6 — Governance & Multi-Tenant (Weeks 31–36)

**Goal:** Open platform to multiple energy source types beyond ThermogenZero.

### 7.1 Governance SmartCircuit

| Task | Details | Week |
|------|---------|------|
| Methodology proposal + vote flow | Proposal → review → vote → approve/reject | 31 |
| Verifier registration flow | Key submission → attestation → approval | 31 |
| Parameter update proposals | Quorum, GWP factor, fees | 32 |
| Voting mechanism | Weighted by credit volume (credit-weighted governance) | 32 |
| Test period enforcement | 90-day cap on new methodology volumes | 32 |

### 7.2 Multi-Tenant Architecture

| Task | Details | Week |
|------|---------|------|
| Tenant onboarding flow | New source type registration | 33 |
| Per-tenant methodology binding | Map tenant → approved methodology | 33 |
| Per-tenant lex namespace | `sc.tenants.{tenant}.*` isolation | 33 |
| Tenant-specific carbon calculation | Pluggable calculation per source type | 34 |
| Solar source type | Basic solar methodology + witness format | 34 |
| Wind source type | Basic wind methodology + witness format | 34 |
| CCS (Carbon Capture & Storage) | CCS methodology + witness format | 35 |

### 7.3 Hardening

| Task | Details | Week |
|------|---------|------|
| Load testing | 1000 witnesses/sec, 100 retirements/sec | 35 |
| Security audit | PQ crypto review, API penetration testing | 35 |
| Disaster recovery | Backup, restore, failover procedures | 36 |
| Runbook & operations guide | Incident response, monitoring, alerting | 36 |

### Phase 6 Exit Criteria

- [ ] Governance voting functional for methodology and parameters
- [ ] At least 2 source types beyond TZ can be onboarded
- [ ] Load test passes at target throughput
- [ ] Security audit complete, all critical findings resolved

---

## 8. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| SmartCircuits | ESCIR + estream-kernel (Rust) | All core logic |
| Wire format | ESF binary encoding (`esf-carbon` pack) | On-wire efficiency |
| Identity | Spark (PQ-authenticated) | ML-KEM-1024 + ML-DSA-87 |
| Crypto | ML-DSA-87 (signatures), SHA3-256 (Merkle), VRF | eStream PQ primitives |
| ZK Proofs | Bulletproofs (range), Groth16 (membership) | Privacy-preserving verification |
| Visibility | `carbon-credit` visibility profile | Tiered access |
| API | REST + GraphQL via eStream API bridge | B2B integration |
| UI | estream-app (React) | Console views |
| Widget | React + vanilla JS + iframe | Embeddable impact display |
| Observability | StreamSight | Telemetry, metrics, alerts |

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Each SmartCircuit has ESCIR `test_vectors` for golden-path and failure modes
- Methodology calculations verified against known EPA AP-42 examples
- Serial number uniqueness tested at scale (100K+ credits)

### 9.2 Integration Tests

- End-to-end: TZ edge → TZ cloud → SC verifier → credit → retirement
- Multi-quorum witness with intentional failures
- API: retire → certificate → webhook delivery
- Marketplace: list → buy → settle → transfer

### 9.3 Load Tests

| Scenario | Target | Duration |
|----------|--------|----------|
| Witness ingestion | 1000 witnesses/sec | 1 hour |
| Credit minting | 100 credits/sec | 1 hour |
| Retirement API | 100 retirements/sec | 1 hour |
| Marketplace search | 500 queries/sec | 30 min |

### 9.4 Compliance Tests

- GHG Protocol export validated by compliance team
- Carbon calculation verified against EPA AP-42 reference data
- Double-spend detection tested with synthetic duplicate witnesses
- Visibility tiers: public user cannot access auditor fields

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| eStream HAS v2.0 not ready (offline support) | Medium | High | Phase 1–3 work without it; degrade to skip offline epochs |
| Energy metering standard not finalized | Medium | Medium | Use existing TZ telemetry format; adapt when standard ships |
| Regulatory requirements change | Low | High | Methodology abstraction allows quick adaptation |
| ThermogenZero deployment delayed | Medium | Medium | Simulate TZ witnesses for development |
| PQ crypto performance on edge | Low | Medium | Already validated in TZ integration plan |
| Double-spend with external registries | Low | Critical | API integration with Verra/GS before mint; manual fallback |

---

## 8. Phase 7 — AI Forecasting & Forward Contracts (Weeks 37–44)

**Goal:** Add intelligence layer with AI yield forecasting, forward pricing oracle, and forward contract engine.

**Spec Collections:** [ai-forecasting/](specs/ai-forecasting/SPEC.md), [forward-contracts/](specs/forward-contracts/SPEC.md)  
**Patents:** ai-carbon-yield-forecasting, forward-carbon-credit-contracts, carbon-forward-pricing-oracle, streaming-carbon-settlement

### 8.1 AI Yield Forecaster

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit `yield_forecaster.escir.yaml` | Inputs: 8 lex topic sources, Outputs: forecasts, accuracy, alerts | 37 |
| Feature engineering pipeline | 18-feature vector from telemetry, market, weather, calendar | 37-38 |
| Mamba/S4 SSM model integration | ESCIR ML Extensions, BitNet b1.58 weights | 38-39 |
| Multi-horizon forecasting (7d/30d/90d/365d) | Confidence intervals (80%/95%) | 39-40 |
| Backtesting engine | Continuous accuracy tracking (MAE, MAPE, R²) | 40 |
| RLHF feedback loop | Operator corrections on `sc.ai.feedback` | 40-41 |
| Yield deviation alerting | >20% deviation for 48h triggers alert | 41 |

### 8.2 Forward Pricing Oracle

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit `forward_pricing_oracle.escir.yaml` | Inputs: spot price, yield forecast, Outputs: forward curve | 41 |
| Cost-of-carry model | `F(T) = S * e^((r-y)*T)` implementation | 41-42 |
| AI supply adjustment | yield forecast -> supply factor -> price adjustment | 42 |
| Vintage/methodology premiums | Configurable premium tables | 42 |
| 8-tenor forward curve builder | 1m to lifetime tenor output | 42-43 |
| Basis monitoring | Forward-spot spread with 2-sigma alerting | 43 |

### 8.3 Forward Contract Engine

| Task | Details | Week |
|------|---------|------|
| Define ESCIR circuit `forward_contracts.escir.yaml` | 9-state FSM, lex topic interactions | 37 |
| Contract proposal/negotiation flow | Propose, counter-offer, accept via lex topics | 37-38 |
| Settlement engine | Auto-settle on `sc.credits.issued` events, FIFO priority | 38-39 |
| Escrow and collateral (L2 operations) | Buyer escrow lock/release, seller collateral | 39-40 |
| Under-delivery detection | Pro-rata expected calculation, default transition | 40-41 |
| Callable option handling | Premium, penalty, notice period | 41 |
| Risk scoring | Per-contract and portfolio risk to StreamSight | 41-42 |
| Platform composition update | Wire into `sc-povc-carbon-platform.escir.yaml` | 42 |
| Integration testing | Full lifecycle: propose -> accept -> settle -> complete | 42-44 |

### Phase 7 Exit Criteria

- [ ] Yield forecaster producing hourly forecasts from TZ telemetry
- [ ] Forward curve published with 8 tenors
- [ ] Forward contract full lifecycle functional (propose -> complete)
- [ ] Automated settlement on mint events
- [ ] Risk monitoring published to StreamSight
- [ ] RLHF feedback loop operational

---

## 9. Phase 8 — Marketplace UI & Marketing Website (Weeks 45–52)

**Goal:** Consumer-facing web app with marketplace, portfolio, and impact widgets. Public marketing website.

**Spec Collection:** [marketplace-ui/](specs/marketplace-ui/SPEC.md)

### 9.1 Web Application

| Task | Details | Week |
|------|---------|------|
| Scaffold web app (React + Vite + `@estream/sdk-browser`) | Project structure following TakeTitle pattern | 45 |
| Spark authentication integration | Login flow with `useSpark()` hook | 45-46 |
| Widget system setup | Register SynergyCarbon widgets into widget registry | 46 |
| WidgetCategory + WidgetRole extension | Add marketplace, portfolio, impact, trading categories; buyer, seller, auditor roles | 46 |
| Marketplace page + widgets | credit-browser, order-book, forward-curve, forward-proposal widgets | 46-48 |
| Portfolio page + widgets | credit-portfolio, portfolio-summary, retirement-certificates, forward-contracts-portfolio | 48-49 |
| Impact page + widgets | impact-counter, impact-certificate, impact-live-meter | 49-50 |
| Analytics page + widgets | yield-forecast, risk-heatmap, forecast-accuracy, delivery-monitor, basis-chart | 50-51 |
| Branding + theming | SynergyCarbon brand overlay on `--es-*` tokens | 51 |
| Cloudflare Pages deployment | Wrangler config, CI/CD | 51-52 |

### 9.2 Marketing Website

| Task | Details | Week |
|------|---------|------|
| Static site scaffold (Next.js SSG or Astro) | Pages: Home, How It Works, For Buyers, For Generators, Technology, About | 48 |
| Embedded impact widgets | iframe from widget system for live counters | 49 |
| Content authoring | Technical credibility, use cases, patent portfolio mention | 49-50 |
| Cloudflare Pages deployment | synergycarbon.io domain | 50-51 |
| SEO + analytics | Meta tags, OG images, analytics tracking | 51 |

### 9.3 Shared Widget Patterns (estream-io Upstream)

| Task | Details | Week |
|------|---------|------|
| Identify shared patterns with TakeTitle | Asset browser, portfolio summary, holdings table, order book, provenance timeline | 45 |
| Propose `@estream/marketplace-widgets` package | PR to estream-io with shared patterns | 46-47 |
| Extract shared components | Generalize TakeTitle patterns into shared package | 47-49 |

### Phase 8 Exit Criteria

- [ ] Web app deployed with Spark authentication
- [ ] All 16 widgets registered and functional
- [ ] Real-time data via lex topic subscriptions (< 1s latency)
- [ ] Impact widgets embeddable via iframe, React, vanilla JS
- [ ] Marketing site deployed at synergycarbon.io
- [ ] WCAG 2.1 AA compliant

---

## 10. Phase 9 — Source Adapters & Market Expansion (Weeks 53–60)

**Goal:** Onboard non-TZ energy sources. Universal witness node hardware. Solar, biogas, and CCS adapters.

**Spec Collection:** [source-adapters/](specs/source-adapters/SPEC.md)  
**Patents:** universal-carbon-witness-node, biogas-povc-attestation, ccs-sequestration-verification, grid-displacement-carbon-methodology

### 10.1 Universal Witness Node

| Task | Details | Week |
|------|---------|------|
| Hardware specification | FPGA/SoC, crypto accelerator, sensor I/O, comms | 53 |
| Standard CarbonWitness frame definition | Unified output interface for all source types | 53 |
| Pluggable firmware architecture | Methodology firmware loading, governance-signed updates | 53-54 |
| PRIME device identity integration | Per-node ML-DSA-87 keypair, hardware attestation | 54 |
| Prototype hardware build | Dev kit for testing | 54-56 |

### 10.2 Solar PV Adapter

| Task | Details | Week |
|------|---------|------|
| `fw-solar-pv` methodology firmware | Inverter power measurement, grid displacement calculation | 55-56 |
| Solar carbon minter circuit | `solar.{tenant}.carbon_minter.v1` ESCIR circuit | 56-57 |
| MEF (marginal emission factor) integration | Grid carbon intensity data feed | 57 |
| Integration test with simulated solar data | End-to-end: solar witness -> verification -> credit | 57-58 |

### 10.3 Biogas / Landfill Gas Adapter

| Task | Details | Week |
|------|---------|------|
| `fw-biogas` methodology firmware | CH4 flow, gas composition, destruction efficiency | 55-56 |
| Biogas carbon minter circuit | `biogas.{tenant}.carbon_minter.v1` ESCIR circuit | 56-57 |
| Anaerobic digestion monitoring | Temperature, pH, biogas composition features | 57 |
| Integration test with simulated biogas data | End-to-end: biogas witness -> verification -> credit | 57-58 |

### 10.4 CCS Adapter (Design Only)

| Task | Details | Week |
|------|---------|------|
| CCS methodology specification | Capture, transport, injection measurement requirements | 58-59 |
| `fw-ccs` firmware architecture | Multi-point monitoring (capture + pipeline + well) | 59 |
| Reservoir integrity proof design | Continuous pressure monitoring protocol | 59-60 |

### 10.5 Tenant Onboarding Flow

| Task | Details | Week |
|------|---------|------|
| Source type registration governance flow | New source type proposal + vote | 58 |
| Methodology approval automation | Proposal -> review -> vote -> test period pipeline | 58-59 |
| Firmware certification process | Test + governance approval for new firmware | 59 |
| Onboarding documentation | Step-by-step guide for new source types | 60 |

### Phase 9 Exit Criteria

- [ ] Universal witness node hardware spec finalized and prototype built
- [ ] Solar PV and biogas adapters functional end-to-end
- [ ] CCS adapter designed (implementation deferred to follow-on)
- [ ] Tenant onboarding flow tested with non-TZ source
- [ ] At least 2 non-TZ source types producing verified attestations

---

## 11. Milestones

| Milestone | Week | Deliverable |
|-----------|------|-------------|
| **M1: Verification** | 6 | PoVCR Verifier accepting TZ witnesses, producing attestations |
| **M2: First Credit** | 12 | First carbon credit NFT minted from TZ attestation |
| **M3: First Retirement** | 18 | First programmatic retirement with certificate |
| **M4: Marketplace Live** | 24 | Credits listed and purchasable on marketplace |
| **M5: Widget Shipped** | 30 | Embeddable impact widget deployed |
| **M6: Multi-Tenant** | 36 | Platform open to non-TZ energy sources |
| **M7: AI + Forwards** | 44 | AI yield forecasting and forward contracts operational |
| **M8: Consumer App** | 52 | Marketplace UI + marketing site live |
| **M9: Multi-Source** | 60 | Solar and biogas sources producing verified credits |

---

## 12. Cross-References

| Document | Repo | Purpose |
|----------|------|---------|
| [DESIGN.md](DESIGN.md) | povc-carbon | Platform architecture and PoVCR protocol |
| [AI_FORWARD_CONTRACTS_SPEC.md](AI_FORWARD_CONTRACTS_SPEC.md) | povc-carbon | AI forecasting and forward contracts |
| [specs/INDEX.md](specs/INDEX.md) | povc-carbon | Spec collections index (8 collections) |
| [PORTFOLIO-REVIEW.md](../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md) | synergythermogen | Patent portfolio (22 patents, 4 clusters) |
| [ESTREAM_CONTROLS_SPEC.md](../../../thermogenzero/microgrid/docs/ESTREAM_CONTROLS_SPEC.md) | TZ microgrid | TZ master controls spec (witness source) |
| [carbon_minter.escir.yaml](../../../thermogenzero/microgrid/circuits/cloud/carbon_minter.escir.yaml) | TZ microgrid | TZ cloud circuit that produces mint requests |
| [ESTREAM_MARKETPLACE_SPEC.md](../../../toddrooke/estream-io/specs/marketplace/ESTREAM_MARKETPLACE_SPEC.md) | estream-io | esf-carbon schema pack |
| [carbon-credit.yaml](../../../toddrooke/estream-io/configs/visibility/profiles/carbon-credit.yaml) | estream-io | Visibility profile |
| [Console CLAUDE.md](../../../toddrooke/estream-io/apps/console/CLAUDE.md) | estream-io | Widget system architecture |
| [TakeTitle Architecture](../../../TakeTitle/taketitle-io/docs/ARCHITECTURE.md) | taketitle-io | Reference UI pattern (marketplace + portfolio) |
| [povc-carbon-02-05-26.md](../../../toddrooke/estream-io/docs/app-feedback/povc-carbon-02-05-26.md) | estream-io | Outstanding platform feature requests |
