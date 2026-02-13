# SynergyCarbon PoVC-Carbon — Platform Design

> **Version:** 1.0.0  
> **Date:** 2026-02-11  
> **Status:** Draft  
> **Platform:** eStream v0.8.1  
> **First Customer:** ThermogenZero (thermoelectric microgrid)  
> **Compliance Targets:** GHG Protocol, Verra VCS, Gold Standard, ISCC

---

## 1. Vision

SynergyCarbon is a **verified carbon credit platform** that provides cryptographic proof of real-world emissions reduction, built entirely on eStream. Unlike traditional carbon registries that rely on periodic audits and self-reported data, SynergyCarbon credits are backed by continuous, hardware-attested telemetry streamed in real-time from energy generation sites.

**Core differentiator:** Every credit is traceable back to a specific hardware witness, Merkle root, and ML-DSA-87 signature — not a spreadsheet.

---

## 2. Platform Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          SynergyCarbon Platform                          │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    eStream Network (L2)                          │    │
│  │                                                                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │    │
│  │  │PoVCR       │  │Credit      │  │Retirement  │  │Audit     │ │    │
│  │  │Verifier SC │  │Registry SC │  │Engine SC   │  │Trail SC  │ │    │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │    │
│  │        │               │               │              │        │    │
│  │  ┌─────┴───────────────┴───────────────┴──────────────┴──────┐ │    │
│  │  │              Lex Topics (sc.*)                              │ │    │
│  │  │  sc.credits.* | sc.attestations.* | sc.retirements.*      │ │    │
│  │  │  sc.marketplace.* | sc.audit.* | sc.governance.*          │ │    │
│  │  └───────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  Console UI       │  │  REST/GraphQL API │  │  Embeddable      │      │
│  │  (estream-app)    │  │  (B2B integration)│  │  Impact Widget   │      │
│  │  Credit mgmt,     │  │  Retirement,      │  │  Counter, cert,  │      │
│  │  marketplace,     │  │  listing, query   │  │  live meter      │      │
│  │  analytics        │  │                   │  │                  │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Tenant Integrations                            │   │
│  │                                                                   │   │
│  │  ThermogenZero ──→ tz.cloud.carbon_minter.v1 ──→ PoVCR Verifier │   │
│  │  [Future] Solar ──→ solar.carbon_minter.v1    ──→ PoVCR Verifier │   │
│  │  [Future] Wind  ──→ wind.carbon_minter.v1     ──→ PoVCR Verifier │   │
│  │  [Future] CCS   ──→ ccs.carbon_minter.v1      ──→ PoVCR Verifier │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Core SmartCircuits

| Circuit | ID | Purpose | Runtime |
|---------|------|---------|---------|
| **PoVCR Verifier** | `sc.core.povcr_verifier.v1` | Verify witness quorum, validate energy claims, produce attestations | estream-kernel |
| **Credit Registry** | `sc.core.credit_registry.v1` | Issue, track, transfer, and retire carbon credit NFTs | estream-kernel |
| **Retirement Engine** | `sc.core.retirement_engine.v1` | API-driven and event-triggered retirement with certificate generation | estream-kernel |
| **Audit Trail** | `sc.core.audit_trail.v1` | Immutable audit log with regulatory export | estream-kernel |
| **Marketplace** | `sc.marketplace.orderbook.v1` | Credit listing, discovery, and trading | estream-kernel |
| **Forward Contracts** | `sc.marketplace.forward_contracts.v1` | Carbon PPA — forward purchase with auto-settlement | estream-kernel |
| **Impact Widget** | `sc.marketplace.impact_widget.v1` | Embeddable real-time impact visualization | estream-app |
| **Yield Forecaster** | `sc.ai.yield_forecaster.v1` | SLM-based carbon yield prediction (Mamba/S4 SSM) | estream-kernel |
| **Pricing Oracle** | `sc.ai.forward_pricing_oracle.v1` | Forward price curve from AI + cost-of-carry model | estream-kernel |

### 2.2 Lex Topic Hierarchy

```
sc.
├── credits.                         # Credit lifecycle
│   ├── issued                       # New credit issuance events
│   ├── transferred                  # Ownership transfers
│   ├── retired                      # Retirement events
│   ├── cancelled                    # Cancellation events
│   └── registry                     # Registry state (all active credits)
├── attestations.                    # Verification
│   ├── submitted                    # New PoVCR attestation submissions
│   ├── verified                     # Verified attestations
│   ├── rejected                     # Failed verification
│   └── registry                     # Attestation registry state
├── retirements.                     # Retirement management
│   ├── requested                    # Pending retirement requests
│   ├── completed                    # Completed retirements
│   ├── certificates                 # Generated certificates
│   └── triggers                     # Active retirement triggers
├── marketplace.                     # Trading
│   ├── listings.active              # Active listings
│   ├── listings.completed           # Filled/expired listings
│   ├── orders                       # Order events
│   └── market_data                  # Pricing, volume, trends
├── audit.                           # Compliance
│   ├── events                       # All auditable events
│   ├── exports                      # Regulatory export jobs
│   └── access_log                   # Field-level access audit
├── governance.                      # Platform governance
│   ├── methodology.approved         # Approved methodologies
│   ├── verifier.registered          # Registered verifier keys
│   ├── parameters                   # Platform parameters (quorum, thresholds)
│   └── proposals                    # Governance proposals
└── tenants.                         # Per-tenant namespaces
    ├── tz.*                         # ThermogenZero
    ├── solar.*                      # Future solar tenants
    └── wind.*                       # Future wind tenants
```

---

## 3. PoVCR Protocol

### 3.1 Overview

The Proof of Verified Compute Result (PoVCR) protocol provides cryptographic proof that a specific amount of energy was generated (or emissions avoided) at a specific site during a specific time period, attested by hardware witnesses.

```
           Tenant Site                    SynergyCarbon Platform
┌─────────────────────────────┐    ┌─────────────────────────────────┐
│                              │    │                                  │
│  FPGA Controller Node        │    │  PoVCR Verifier SC               │
│  ├─ MPPT (power data)       │    │  ├─ Signature verification       │
│  ├─ Merkle tree (SHA3-256)  │───→│  ├─ VRF proof check              │
│  ├─ VRF (witness selection) │    │  ├─ Quorum collection            │
│  └─ ML-DSA-87 signature     │    │  ├─ Merkle root consensus        │
│                              │    │  ├─ Energy claim validation      │
│                              │    │  └─ Attestation record emission  │
└─────────────────────────────┘    │                                  │
                                    │  Credit Registry SC              │
                                    │  ├─ Attestation → Credit mint    │
                                    │  ├─ NFT issuance (ERC-721)      │
                                    │  └─ Registry state update        │
                                    └─────────────────────────────────┘
```

### 3.2 Verification Steps

1. **Signature Check** — Verify ML-DSA-87 signature on witness frame using site's registered public key
2. **VRF Validation** — Verify the VRF proof that this site was selected as a witness for this epoch
3. **Quorum Collection** — Collect witnesses from N sites for the same epoch (quorum = 3 default)
4. **Merkle Root Consensus** — Verify all quorum witnesses agree on the Merkle root (or supermajority)
5. **Energy Claim Validation** — Cross-validate energy claims: `max_deviation / mean < 5%`
6. **Historical Baseline** — Compare against rolling 30-day average (flag if >20% deviation)
7. **Carbon Calculation** — Apply methodology (EPA AP-42, IPCC factors) to convert energy → tCO2e
8. **Attestation Emission** — Publish verified attestation to `sc.attestations.verified`

### 3.3 Failure Modes

| Failure | Detection | Action |
|---------|-----------|--------|
| Invalid signature | Step 1 | Reject witness, log to `sc.attestations.rejected` |
| Invalid VRF proof | Step 2 | Reject witness |
| Quorum timeout (5 min) | Step 3 | Defer to next epoch, flag site connectivity |
| Merkle root disagreement | Step 4 | Reject epoch, trigger investigation |
| Energy claim >5% deviation | Step 5 | Flag for manual review, mint at lowest claim |
| >20% deviation from baseline | Step 6 | Pause auto-mint, require auditor approval |
| Methodology error | Step 7 | Reject, flag misconfiguration |

### 3.4 Supported Methodologies

| ID | Methodology | Source Types | Carbon Calculation |
|----|-------------|-------------|-------------------|
| `EPA-AP42-CH4-FLARE` | EPA AP-42 methane flare avoidance | TEG, gas-to-power | CH4 mass × GWP factor |
| `IPCC-AR5-100Y` | IPCC AR5 100-year GWP | All | Standard GWP = 28 for CH4 |
| `IPCC-AR5-20Y` | IPCC AR5 20-year GWP | All | Standard GWP = 84 for CH4 |
| `VCS-AMS-III-H` | Verra AMS-III.H (methane recovery) | Methane capture | Verra-specific calculation |
| `GS-MICRO-SCALE` | Gold Standard micro-scale | Small generators | Gold Standard formula |
| `CDM-ACM0001` | CDM flare gas recovery | Flare gas | CDM-specific formula |
| `CUSTOM` | Custom (requires auditor approval) | Any | Tenant-defined |

---

## 4. Credit Registry

### 4.1 Credit Lifecycle

```
                   ┌──────────┐
   Attestation ───→│  Issued  │
   verified         └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌──────────┐
         │Listed  │ │Transfer│ │ Retired  │
         │(market)│ │(direct)│ │(consumed)│
         └───┬────┘ └────────┘ └──────────┘
             │
             ▼
        ┌─────────┐
        │  Sold   │──→ Transfer → Retired
        └─────────┘

   At any point:
        ┌───────────┐
        │ Cancelled │  (governance action, audit failure)
        └───────────┘
```

### 4.2 Credit NFT Structure

Each carbon credit is an ERC-721-compatible NFT on eStream L2:

```yaml
CarbonCreditNFT:
  # Immutable at mint
  credit_id: bytes32          # Unique credit ID (hash of attestation + serial)
  project_id: string(64)      # Source project (e.g., "tz-wellpad-alpha-01")
  vintage_year: u16            # Year of emission reduction
  credit_type: CreditType      # Avoidance | Removal | Sequestration
  methodology: string(64)      # Methodology ID (e.g., "EPA-AP42-CH4-FLARE")
  tonnes_co2e: u64             # Fixed-point, 6 decimals (1,000,000 = 1.0 tCO2e)
  attestation_id: bytes32      # Link to PoVCR attestation
  merkle_root: bytes32         # Witness Merkle root
  issued_at: timestamp
  
  # Mutable
  owner: bytes32               # Current owner (Spark-authenticated)
  status: CreditStatus         # Issued | Listed | Sold | Retired | Cancelled
  retired_at: timestamp?       # Set when retired
  retired_by: bytes32?         # Retiring entity
  retirement_reason: string?   # "Offset for Q1 2026 operations"
  serial_number: string(128)   # Registry serial (e.g., "SC-2026-TZ-000001")
```

### 4.3 Visibility Tiers

Using the eStream `carbon-credit` visibility profile:

| Audience | Access | Use Case |
|----------|--------|----------|
| **public** | credit_id, tonnes_co2e, vintage, status, registry | Anyone verifying a credit |
| **buyer** | + methodology, source_type, issuer, verification_body | Due diligence before purchase |
| **auditor** | + site_location, device_ids, raw_telemetry_sample | Third-party verification (90-day access) |
| **owner** | + cost_data, revenue, business_metrics | Credit originator internals |

### 4.4 Double-Spend Prevention

- **On-chain uniqueness:** Each `credit_id` is a unique NFT — cannot exist twice
- **Serial number registry:** Global serial number sequence prevents duplicate issuance
- **Retirement is irreversible:** Once retired, status cannot revert
- **Cross-registry check:** Before mint, verify serial not registered on Verra/GS/CDM (API check)
- **ZK proof:** `not_double_spent` Merkle inclusion proof verifiable by anyone

---

## 5. Retirement Engine

### 5.1 Retirement Triggers

| Trigger Type | Description | Example |
|-------------|-------------|---------|
| **API call** | `POST /api/v1/retire` | B2B integration, e-commerce checkout |
| **Stream event** | Lex topic predicate | `order.status == 'completed'` → retire 0.5 tCO2e |
| **Schedule** | Cron-based | Monthly retirement of accumulated credits |
| **Threshold** | Balance/cumulative trigger | Retire when balance > 100 tCO2e |

### 5.2 Retirement Flow

```
Retirement Request (API / trigger / schedule)
    │
    ▼
Validation
    ├─ Credit exists and status = Issued/Sold
    ├─ Requester is owner or authorized delegate
    ├─ Idempotency check (dedup key)
    └─ Sufficient balance for quantity
    │
    ▼
Execution
    ├─ Set credit.status = Retired
    ├─ Set credit.retired_at = now
    ├─ Set credit.retired_by = requester
    ├─ Set credit.retirement_reason = provided reason
    └─ Emit to sc.retirements.completed
    │
    ▼
Certificate Generation
    ├─ PDF certificate (branded, with QR code)
    ├─ On-chain record (immutable)
    ├─ Webhook notification to owner
    └─ Impact widget update (real-time)
```

### 5.3 Certificate Format

Each retirement generates a verifiable certificate:

```
┌─────────────────────────────────────────────────┐
│          VERIFIED CARBON RETIREMENT              │
│                                                  │
│  Certificate ID: SC-RET-2026-000042             │
│  Quantity: 1.500 tCO2e                          │
│  Vintage: 2026                                   │
│  Project: TZ Wellpad Alpha-01                    │
│  Methodology: EPA AP-42 CH4 Flare Avoidance     │
│  Source: ThermogenZero TEG Microgrid             │
│                                                  │
│  Retired by: Acme Corp                           │
│  Retired at: 2026-03-15T14:30:00Z               │
│  Reason: Q1 2026 operations offset              │
│                                                  │
│  Attestation: 0xABCD...1234                      │
│  Merkle Root: 0x5678...9ABC                      │
│  Witness Quorum: 3/5 sites                       │
│                                                  │
│  [QR CODE]  Verify: sc.estream.dev/verify/42    │
│                                                  │
│  Powered by eStream PoVCR                        │
└─────────────────────────────────────────────────┘
```

---

## 6. Marketplace

### 6.1 Listing Model

Credit owners can list credits for sale on the SynergyCarbon marketplace:

| Field | Description |
|-------|-------------|
| `listing_id` | Unique listing identifier |
| `credit_ids` | Credits included (1 or batch) |
| `total_tonnes` | Total tCO2e offered |
| `price_per_tonne` | Ask price (USD or ES token) |
| `min_purchase` | Minimum purchase quantity |
| `vintage_year` | Credit vintage |
| `methodology` | Verification methodology |
| `project_name` | Source project |
| `expires_at` | Listing expiration |

### 6.2 Discovery & Filtering

Buyers can filter credits by:
- Vintage year (range)
- Credit type (Avoidance / Removal / Sequestration)
- Methodology (EPA, IPCC, Verra, Gold Standard)
- Source type (TEG, solar, wind, CCS)
- Price range
- Project/region
- Verification confidence (%)

### 6.3 Settlement

1. Buyer places order via marketplace or API
2. Escrow: buyer funds locked in eStream payment channel
3. Credit transferred: `owner` field updated to buyer
4. Funds released to seller
5. Both parties notified
6. StreamSight audit trail recorded

---

## 7. Audit & Compliance

### 7.1 Audit Trail Requirements

Every operation is logged to `sc.audit.events` with:
- Timestamp (microsecond precision)
- Actor (Spark-authenticated identity)
- Action (issue, transfer, retire, list, cancel)
- Subject (credit_id or attestation_id)
- Details (before/after state)
- Signature (ML-DSA-87 signed event)

### 7.2 Regulatory Export

| Standard | Format | Frequency | Audience |
|----------|--------|-----------|----------|
| GHG Protocol | XLSX/CSV | Annual | Corporate reporters |
| Verra VCS | VCS Registry API | Per-issuance | Registry operators |
| Gold Standard | GS Registry API | Per-issuance | Registry operators |
| ISCC | ISCC-compliant JSON | Quarterly | Certification bodies |
| SOC2 | Structured audit log | Continuous | Auditors |

### 7.3 Third-Party Auditor Access

Auditors authenticate via Spark and receive time-limited (90-day) elevated access:
- Site-level telemetry samples
- Device identifiers and hardware specs
- Raw Merkle proofs and witness data
- Methodology calculation breakdown
- Access is logged and revocable

---

## 8. B2B Integration API

### 8.1 REST API

```
POST   /api/v1/credits/retire          # Retire credits
GET    /api/v1/credits/{id}            # Get credit details
GET    /api/v1/credits                 # List credits (filtered)
POST   /api/v1/credits/verify          # Verify a credit (public)
GET    /api/v1/retirements             # List retirements
GET    /api/v1/retirements/{id}        # Get retirement + certificate
POST   /api/v1/marketplace/list        # List credits for sale
GET    /api/v1/marketplace/search      # Search marketplace
POST   /api/v1/marketplace/buy         # Purchase credits
POST   /api/v1/triggers                # Create retirement trigger
GET    /api/v1/triggers                # List active triggers
DELETE /api/v1/triggers/{id}           # Remove trigger
GET    /api/v1/impact/{entity_id}      # Get impact summary (for widget)
GET    /api/v1/audit/export            # Export audit trail
```

### 8.2 Authentication

- **Spark** — PQ-authenticated identity for all write operations
- **API Key** — For automated B2B integrations (scoped to specific operations)
- **OAuth2** — For third-party app integrations
- All API calls are logged to `sc.audit.access_log`

### 8.3 Webhooks

Clients can register webhooks for:
- `credit.issued` — New credit minted
- `credit.retired` — Credit retired (with certificate URL)
- `trigger.fired` — Retirement trigger activated
- `marketplace.sold` — Listed credit purchased
- `attestation.verified` — New PoVCR attestation

---

## 9. Impact Widget

Embeddable widget for enterprises to display verified carbon impact:

### 9.1 Variants

| Variant | Display | Use Case |
|---------|---------|----------|
| **Counter** | Running total tCO2e retired | Corporate website |
| **Certificate** | Visual retirement certificate | Order confirmation page |
| **Live Meter** | Real-time generation/avoidance | Energy dashboard |
| **Leaderboard** | Multi-entity comparison | Industry rankings |

### 9.2 Embedding

```html
<!-- Simple iframe embed -->
<iframe src="https://sc.estream.dev/widget/counter/ENTITY_ID"
        width="300" height="150" frameborder="0"></iframe>

<!-- React component -->
<SynergyImpactWidget entityId="ENTITY_ID" variant="counter" theme="dark" />

<!-- Vanilla JS -->
<div id="sc-widget"></div>
<script src="https://sc.estream.dev/widget.js"></script>
<script>SynergyCarbon.mount('sc-widget', { entityId: 'ENTITY_ID', variant: 'counter' })</script>
```

### 9.3 Real-Time Updates

Widget connects via WebSocket to `sc.retirements.completed` lex topic and updates in real-time (< 1s from retirement to display).

---

## 10. Governance

### 10.1 Platform Parameters

| Parameter | Default | Governance |
|-----------|---------|------------|
| Quorum size | 3 witnesses | Proposal + vote |
| Quorum window | 5 minutes | Proposal + vote |
| GWP factor | 28 (IPCC AR5 100-year) | Proposal + vote |
| Verification discount | 5% conservative | Proposal + vote |
| Minimum mint | 0.001 tCO2e | Admin |
| Listing fee | 0.5% of sale | Proposal + vote |
| Retirement fee | $0.10 per retirement | Proposal + vote |

### 10.2 Methodology Approval

New methodologies require:
1. Formal proposal with calculation formula
2. Third-party auditor review
3. Governance vote (>66% approval)
4. Test period (90 days, capped volume)
5. Full approval

### 10.3 Verifier Registration

Sites register their public keys (ML-DSA-87) via governance:
1. Site submits key registration request
2. Hardware attestation (T0/TSSP device proof)
3. Physical site verification (auditor visit or remote)
4. Governance approval
5. Key added to verifier registry

---

## 11. AI Yield Forecasting

SynergyCarbon includes an AI-powered yield forecaster that predicts future carbon credit minting volume per tenant and project, enabling forward pricing and risk management.

### 11.1 Architecture

- **Model:** Mamba/S4 SSM (State Space Model) with BitNet b1.58 ternary weights
- **Inference:** Hourly forecast refresh across 4 horizons (7d, 30d, 90d, 365d)
- **Training:** 0.4 inference feedback / 0.6 operational corpus, retrained every 5,000 samples
- **RLHF:** Operator corrections weighted by experience tier

### 11.2 Corpus (All via Lex Topic Subscriptions)

| Source | Lex Topic | Feature Extraction |
|--------|-----------|-------------------|
| Credit minting | `sc.credits.issued` | Minting rate (tCO2e/day), batch size |
| Spot pricing | `sc.marketplace.market_data` | Price EWMA, volume |
| Attestation rate | `sc.attestations.verified` | Quorum success rate |
| Tenant power | `tz.teg.power` | Power output, capacity factor |
| Carbon accrual | `tz.carbon.accrual.*` | Gas flow, net CO2e |
| Fleet health | `tz.fleet.*` | Active sites, capacity |
| Weather | `sc.external.weather` | Temperature, wind, irradiance |
| Forward commitments | `sc.forwards.contracts.active` | Committed volume |

### 11.3 Outputs

| Output | Lex Topic | Description |
|--------|-----------|-------------|
| Yield forecast | `sc.ai.forecasts.yield.{tenant}.{project}` | Projected tCO2e with 80%/95% confidence |
| Capacity factor | `sc.ai.forecasts.capacity.{tenant}.{project}` | Projected utilization |
| Accuracy metrics | `sc.ai.accuracy.yield.*` | Rolling MAE, MAPE, R² |
| Deviation alerts | `sc.ai.alerts.yield_deviation` | >20% deviation for 48h+ |

### 11.4 Forward Pricing Oracle

Combines three signals into a forward price curve across 8 tenors (1m to project-lifetime):

1. **Cost-of-carry:** `F = S * e^((r - y) * T)` (financial model)
2. **AI supply adjustment:** yield forecast confidence → supply pressure
3. **Vintage and methodology premiums:** aging discount, methodology multipliers

Published to `sc.ai.forecasts.price.forward_curve` for consumption by the Forward Contract Engine and console widgets.

**Detailed specification:** [AI_FORWARD_CONTRACTS_SPEC.md](AI_FORWARD_CONTRACTS_SPEC.md)

---

## 12. Forward Contracts (Carbon PPAs)

Buyers can lock in a price for future carbon credits over a fixed term or project lifetime, with automated settlement as credits are minted. All interactions are SmartCircuit-native — typed ESF frames on lex topics, Spark-authenticated.

### 12.1 Contract Types

| Type | Term | Delivery | Use Case |
|------|------|----------|----------|
| **Fixed-Term** | 3m–5y | Monthly pro-rata | Corporate ESG budgets |
| **Project-Lifetime** | Full life | Continuous as minted | Long-term PPA |
| **Volume-Committed** | Until filled | As minted | "Buy 1000 tCO2e at $X" |
| **Callable** | Any + call option | Per underlying | Flexible demand |

### 12.2 Lifecycle

`Proposed → Negotiation → Active → Delivering → Completed`

With paths to `Suspended` (site offline), `Defaulted` (under-delivery), and `Terminated` (callable exercise or mutual).

### 12.3 Settlement

Fully automated — on each `sc.credits.issued` event, the Forward Contract Engine:
1. Finds matching active contracts (project, methodology)
2. Allocates credits (FIFO by contract age)
3. Transfers ownership via Credit Registry
4. Debits buyer escrow, credits seller via L2 escrow operations

### 12.4 Risk Monitoring (StreamSight)

| Metric | Lex Topic | Description |
|--------|-----------|-------------|
| Per-contract risk | `sc.forwards.risk.delivery` | 0-100 score from delivery ratio, forecast, escrow, collateral |
| Portfolio risk | `sc.forwards.risk.portfolio` | Aggregate across all contracts |
| Escrow alert | `sc.forwards.risk.escrow_low` | Buyer escrow < 1 month |
| Collateral call | `sc.forwards.risk.collateral_call` | Seller collateral below minimum |
| Basis spread | `sc.forwards.market.basis` | Forward vs. spot price spread |

### 12.5 Lex Topic Interaction Model

| Action | Topic | Publisher |
|--------|-------|-----------|
| Propose | `sc.forwards.propose` | Buyer |
| Counter-offer | `sc.forwards.counter` | Seller |
| Accept | `sc.forwards.accept` | Either party (ML-DSA-87 signed) |
| Terminate | `sc.forwards.terminate` | Either party |
| Settlement | Automated | SmartCircuit (on mint event) |
| RLHF feedback | `sc.ai.feedback` | Operator |

**Detailed specification:** [AI_FORWARD_CONTRACTS_SPEC.md](AI_FORWARD_CONTRACTS_SPEC.md)

---

## 13. Cross-References

### Spec Collections

| Collection | Path | Description |
|-----------|------|-------------|
| [Spec Index](specs/INDEX.md) | specs/ | Master index: 8 collections mapping to patents and phases |
| [Verification](specs/verification/SPEC.md) | specs/verification/ | PoVCR protocol, attestation |
| [Credit Lifecycle](specs/credit-lifecycle/SPEC.md) | specs/credit-lifecycle/ | Credit Registry, NFT, retirement |
| [Marketplace](specs/marketplace/SPEC.md) | specs/marketplace/ | Order book, trading, settlement |
| [AI Forecasting](specs/ai-forecasting/SPEC.md) | specs/ai-forecasting/ | Yield forecaster, pricing oracle |
| [Forward Contracts](specs/forward-contracts/SPEC.md) | specs/forward-contracts/ | Carbon PPAs, streaming settlement |
| [Compliance](specs/compliance/SPEC.md) | specs/compliance/ | Audit trail, registry bridge |
| [Source Adapters](specs/source-adapters/SPEC.md) | specs/source-adapters/ | Universal witness node, multi-source |
| [Marketplace UI](specs/marketplace-ui/SPEC.md) | specs/marketplace-ui/ | Widget-based marketplace + portfolio UI |

### Related Documents

| Document | Repo | Purpose |
|----------|------|---------|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | povc-carbon | 9-phase build plan (60 weeks) |
| [AI_FORWARD_CONTRACTS_SPEC.md](AI_FORWARD_CONTRACTS_SPEC.md) | povc-carbon | AI forecasting and forward contracts specification |
| [PORTFOLIO-REVIEW.md](../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md) | synergythermogen | Patent portfolio (22 patents, 4 clusters) |
| [ESTREAM_CONTROLS_SPEC.md](../../thermogenzero/microgrid/docs/ESTREAM_CONTROLS_SPEC.md) | TZ microgrid | TZ master controls spec (first customer) |
| [ESTREAM_MARKETPLACE_SPEC.md](../../toddrooke/estream-io/specs/marketplace/ESTREAM_MARKETPLACE_SPEC.md) | estream-io | eStream marketplace + esf-carbon schemas |
| [carbon-credit.yaml](../../toddrooke/estream-io/configs/visibility/profiles/carbon-credit.yaml) | estream-io | Visibility profile |
| [ESCIR_ML_EXTENSIONS.md](../../toddrooke/estream-io/specs/protocol/ESCIR_ML_EXTENSIONS.md) | estream-io | ESCIR ML extensions (tensor types, SSM primitives) |
| [trend-detector.escir.yaml](../../toddrooke/estream-io/circuits/ops/trend-detector.escir.yaml) | estream-io | Online regression pattern (trend detection) |
| [TZ-AI-SPEC.md](../../thermogenzero/microgrid/docs/TZ-AI-SPEC.md) | TZ microgrid | TZ AI corpus and training patterns |
| [Console CLAUDE.md](../../toddrooke/estream-io/apps/console/CLAUDE.md) | estream-io | Widget system architecture |
| [TakeTitle Architecture](../../TakeTitle/taketitle-io/docs/ARCHITECTURE.md) | taketitle-io | Reference UI pattern (marketplace + portfolio) |
| [povc-carbon-02-05-26.md](../../toddrooke/estream-io/docs/app-feedback/povc-carbon-02-05-26.md) | estream-io | Outstanding feature requests |
