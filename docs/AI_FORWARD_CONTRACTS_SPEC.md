# SynergyCarbon AI Forecasting and Forward Contract Specification

> **Version:** 1.0.0  
> **Date:** 2026-02-11  
> **Status:** Draft  
> **Platform:** eStream v0.8.1  
> **Dependencies:** ESCIR ML Extensions (Epic #470), StreamSight trend-detector, esf-carbon schemas  
> **Design Reference:** [DESIGN.md](DESIGN.md)

---

## 1. Overview

This specification defines two new SmartCircuit subsystems for the SynergyCarbon platform:

1. **AI Yield Forecasting Engine** — predicts future carbon credit minting volume and fair forward pricing using SLM-based inference over historical minting, tenant telemetry, and external data
2. **Forward Contract Engine** — enables buyers to lock in a price for future carbon credits over fixed terms or project lifetimes, with automated settlement as credits are minted

Both subsystems are fully native to eStream: all interactions are typed ESF frames on lex topics, Spark-authenticated, StreamSight-observable, and audit-trailed. No external API layer is required.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SynergyCarbon AI + Forward Contracts                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Data Sources (lex topic subscriptions)                            │ │
│  │                                                                    │ │
│  │  sc.credits.issued        Mint events from Credit Registry        │ │
│  │  sc.marketplace.market_data  Spot prices, volume, listings        │ │
│  │  sc.attestations.verified   PoVCR attestation rate                │ │
│  │  tz.teg.power              Tenant power generation (1 Hz)         │ │
│  │  tz.carbon.accrual.*       Gas consumed, CO2e avoided             │ │
│  │  tz.fleet.*                Fleet health, site count, capacity     │ │
│  │  sc.external.weather       Weather data (15-min, ingested)        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────────────────────┐                                   │
│  │  sc.ai.yield_forecaster.v1       │ ← SLM: Mamba/S4 SSM, BitNet     │
│  │                                   │                                   │
│  │  Corpus Ingestion ──→ Feature     │                                   │
│  │  Engineering ──→ SSM Inference    │                                   │
│  │  ──→ Multi-horizon Forecast       │                                   │
│  │  ──→ Confidence Intervals         │                                   │
│  │                                   │                                   │
│  │  StreamSight:                     │                                   │
│  │    sc.ai.forecasts.yield.*        │                                   │
│  │    sc.ai.accuracy.*               │                                   │
│  │    sc.ai.alerts.yield_deviation   │                                   │
│  └──────────┬───────────────────────┘                                   │
│             │                                                            │
│             ▼                                                            │
│  ┌──────────────────────────────────┐                                   │
│  │  sc.ai.forward_pricing_oracle.v1 │                                   │
│  │                                   │                                   │
│  │  AI Yield Forecast ──→ Supply     │                                   │
│  │  Projection ──→ Cost-of-Carry     │                                   │
│  │  Model ──→ Vintage Premium ──→    │                                   │
│  │  Forward Curve (8 tenors)         │                                   │
│  │                                   │                                   │
│  │  StreamSight:                     │                                   │
│  │    sc.ai.forecasts.price.*        │                                   │
│  │    sc.forwards.market.basis       │                                   │
│  └──────────┬───────────────────────┘                                   │
│             │                                                            │
│             ▼                                                            │
│  ┌──────────────────────────────────┐                                   │
│  │  sc.marketplace.forward_contracts│                                   │
│  │  .v1                             │                                   │
│  │                                   │                                   │
│  │  Contract FSM (9 states)          │                                   │
│  │  Settlement Engine (auto-deliver) │                                   │
│  │  Escrow/Collateral (L2 ops)       │                                   │
│  │  Risk Monitor (delivery risk)     │                                   │
│  │                                   │                                   │
│  │  StreamSight:                     │                                   │
│  │    sc.forwards.contracts.*        │                                   │
│  │    sc.forwards.settlements.*      │                                   │
│  │    sc.forwards.risk.*             │                                   │
│  └──────────────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Yield Forecasting Engine

### 3.1 Model Architecture

The yield forecaster uses eStream's ESCIR ML Extensions:

- **Base architecture:** Mamba/S4 SSM (State Space Model) — ideal for time-series with long-range dependencies (seasonal patterns across months/years)
- **Weight format:** BitNet b1.58 ternary weights — compact, efficient inference in estream-kernel
- **Training pattern:** 0.4 inference feedback / 0.6 operational corpus (mirrors TZ-AI-SPEC)
- **Inference frequency:** Hourly forecast refresh (configurable)
- **RLHF:** Operator corrections weighted by experience tier

### 3.2 Corpus Ingestion

All training data arrives via lex topic subscriptions — no external data pipelines:

| Source | Lex Topic | Rate | Feature Extraction |
|--------|-----------|------|--------------------|
| Credit minting | `sc.credits.issued` | On event | Minting rate (tCO2e/day), batch size, vintage |
| Spot pricing | `sc.marketplace.market_data` | 1 min | Price EWMA, volume, bid-ask spread |
| Attestation rate | `sc.attestations.verified` | On event | Verification throughput, quorum success rate |
| Tenant power | `tz.teg.power` | 1 Hz (downsampled to 5-min EWMA) | Power output, capacity factor |
| Carbon accrual | `tz.carbon.accrual.*` | 1 min | Gas flow, CH4 mass, net CO2e |
| Fleet health | `tz.fleet.*` | 5 min | Active sites, degraded sites, total capacity |
| Weather | `sc.external.weather` | 15 min | Temperature, wind, irradiance (affects TEG cold-side, solar) |
| Forward contracts | `sc.forwards.contracts.active` | On event | Committed volume, delivery pressure |

Feature engineering runs as a compute graph node, producing a fixed-width feature vector per observation window (configurable, default 1 hour):

```yaml
FeatureVector:
  # Power generation features
  - power_mean_w: f32          # Mean power output (EWMA)
  - power_trend_slope: f32     # From trend-detector regression
  - power_r_squared: f32       # Trend confidence
  - capacity_factor: f32       # Actual / nameplate

  # Carbon features
  - minting_rate_tco2e_day: f32  # Rolling 24h minting rate
  - gas_flow_mcf_hour: f32       # Gas consumption rate
  - attestation_success_rate: f32 # Quorum success / attempts

  # Market features
  - spot_price_usd: f32         # Current spot price (EWMA)
  - spot_volume_24h: f32        # 24h trading volume
  - forward_committed_tco2e: f32 # Volume locked in forwards

  # External features
  - ambient_temp_c: f32         # Ambient temperature
  - wind_speed_ms: f32          # Wind speed
  - irradiance_wm2: f32         # Solar irradiance

  # Calendar features (cyclical encoding)
  - hour_sin: f32               # sin(2π * hour / 24)
  - hour_cos: f32               # cos(2π * hour / 24)
  - day_sin: f32                # sin(2π * day_of_year / 365)
  - day_cos: f32                # cos(2π * day_of_year / 365)
  - is_weekend: f32             # Binary
```

### 3.3 Forecast Outputs

Published to `sc.ai.forecasts.*` lex topics:

| Output | Lex Topic | Update Rate | Description |
|--------|-----------|-------------|-------------|
| Yield forecast | `sc.ai.forecasts.yield.{tenant}.{project}` | Hourly | Projected tCO2e at 7d/30d/90d/365d horizons |
| Confidence interval | (embedded in YieldForecast) | Hourly | 80% and 95% CI bounds per horizon |
| Seasonal decomposition | `sc.ai.forecasts.seasonal.{tenant}` | Daily | Trend, seasonal, residual components |
| Capacity factor | `sc.ai.forecasts.capacity.{tenant}.{project}` | Hourly | Projected utilization vs. nameplate |
| Fleet aggregate | `sc.ai.forecasts.yield.{tenant}.fleet` | Hourly | Sum across all projects for tenant |

### 3.4 Accuracy Tracking (StreamSight)

The forecaster continuously backtests against realized minting:

| Metric | Lex Topic | Calculation | Target |
|--------|-----------|-------------|--------|
| MAE (7d) | `sc.ai.accuracy.yield.mae_7d` | Mean absolute error, 7-day forecast | < 10% |
| MAPE (30d) | `sc.ai.accuracy.yield.mape_30d` | Mean absolute % error, 30-day | < 15% |
| MAPE (90d) | `sc.ai.accuracy.yield.mape_90d` | Mean absolute % error, 90-day | < 20% |
| R² (trend) | `sc.ai.accuracy.yield.r_squared` | Trend component fit | > 0.8 |
| Model version | `sc.ai.corpus.model_version` | Current model checkpoint | — |
| Corpus size | `sc.ai.corpus.sample_count` | Training samples ingested | — |

**Yield deviation alerts** fire when actual minting deviates >20% from forecast for 48+ hours:

```
sc.ai.alerts.yield_deviation:
  tenant_id: "thermogenzero"
  project_id: "tz-wellpad-alpha-01"
  forecast_tco2e_day: 0.85
  actual_tco2e_day: 0.42
  deviation_pct: -50.6
  duration_hours: 52
  severity: warning
  possible_causes: ["site_offline", "gas_supply_interruption", "equipment_degradation"]
```

### 3.5 RLHF Feedback

Operators can correct forecasts by publishing to `sc.ai.feedback`:

```yaml
ForecastCorrection:
  forecast_id: bytes(32)
  correction_type: "override" | "bias_adjust" | "exclude_period"
  corrected_value: f32
  reason: string(256)
  operator_tier: u8         # Experience weight (1-5)
```

Training trigger: 5,000 SC samples per batch (same pattern as TZ-AI-SPEC).

---

## 4. Forward Pricing Oracle

### 4.1 Pricing Model

The oracle combines three pricing signals:

**Signal 1: Cost-of-Carry (financial model)**

```
F(T) = S × e^((r - y) × T)

where:
  S = current spot price (EWMA from sc.marketplace.market_data)
  r = risk-free rate (configurable, default 5% annual)
  y = convenience yield (value of holding spot credits, estimated from market)
  T = time to delivery (years)
```

**Signal 2: AI Supply Adjustment**

```
supply_factor = forecast_yield(T) / historical_avg_yield

If supply_factor > 1.0 → downward price pressure (more supply coming)
If supply_factor < 1.0 → upward price pressure (supply tightening)

adjusted_F(T) = F(T) × (1 / supply_factor)^elasticity
  where elasticity = 0.3 (configurable)
```

**Signal 3: Vintage and Methodology Premium**

```
vintage_premium = 1.0 + vintage_decay × (current_year - vintage_year)
  where vintage_decay = -0.02 (2% discount per year of aging)

methodology_premium = {
  "EPA-AP42-CH4-FLARE": 1.0,    # Baseline
  "VCS-AMS-III-H": 1.15,        # Verra premium
  "GS-MICRO-SCALE": 1.20,       # Gold Standard premium
  "CDM-ACM0001": 0.95,          # CDM slight discount
}
```

**Combined forward price:**

```
ForwardPrice(T) = adjusted_F(T) × vintage_premium × methodology_premium
```

### 4.2 Forward Curve

Published to `sc.ai.forecasts.price.forward_curve`:

```yaml
ForwardCurve:
  timestamp: u64
  spot_price_usd: f64
  tenors:
    - { tenor: "1m",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "3m",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "6m",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "1y",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "2y",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "3y",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "5y",  price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
    - { tenor: "lifetime", price_usd: f64, confidence_80_lo: f64, confidence_80_hi: f64 }
  basis_vs_spot:
    - { tenor: "1m", basis_usd: f64 }  # Forward - Spot
    ...
```

### 4.3 Basis Monitoring (StreamSight)

The spread between forward and spot prices (basis) is a key risk indicator:

- `sc.forwards.market.basis` — forward minus spot at each tenor, updated every minute
- `sc.forwards.market.basis_alert` — alert when basis exceeds historical 2-sigma

---

## 5. Forward Contract Engine

### 5.1 Contract Types

| Type | ID | Term | Delivery | Pricing | Use Case |
|------|----|------|----------|---------|----------|
| **Fixed-Term** | `fixed_term` | 3m/6m/1y/2y/3y/5y | Monthly pro-rata | Locked at execution | Corporate ESG budgets |
| **Project-Lifetime** | `project_lifetime` | Full project life | Continuous as minted | Locked at execution | Long-term PPA commitment |
| **Volume-Committed** | `volume_committed` | Until volume delivered | As minted, up to total | Locked at execution | "Buy 1000 tCO2e at $X" |
| **Callable** | `callable` | Any term + call option | Per underlying type | Locked + call premium | Flexible demand |

### 5.2 Contract Structure

```yaml
ForwardContract:
  # Identity
  contract_id: bytes(32)          # SHA3-256 of (buyer + seller + terms + timestamp)
  contract_type: ContractType     # fixed_term | project_lifetime | volume_committed | callable

  # Parties (Spark-authenticated)
  buyer: bytes(32)                # Buyer identity
  seller: bytes(32)               # Seller identity (typically the tenant/project owner)

  # Terms
  project_id: string(64)          # Source project
  tenant_id: string(64)           # Source tenant
  methodology_id: string(64)      # Required methodology
  credit_type: CreditType         # Avoidance | Removal | Sequestration
  vintage_year_min: u16           # Minimum acceptable vintage

  # Pricing
  price_per_tonne_usd: f64        # Locked forward price
  oracle_price_at_execution: f64  # Oracle reference price when contract was struck
  total_value_usd: f64            # Total contract value

  # Volume
  total_committed_tco2e: f64      # Total volume to deliver
  delivered_tco2e: f64            # Volume delivered so far
  settlement_frequency: string(16) # "on_mint" | "monthly" | "quarterly"

  # Term
  start_date: u64                 # Contract activation timestamp
  end_date: u64                   # Contract expiration (0 for project_lifetime)
  term_months: u16                # Term in months (0 for volume_committed)

  # Callable option (if contract_type == callable)
  call_premium_pct: f32           # Premium paid for call option
  call_penalty_pct: f32           # Penalty for early termination
  call_notice_days: u16           # Required notice period

  # Escrow and collateral
  buyer_escrow_usd: f64           # Buyer's prepaid escrow balance
  seller_collateral_usd: f64      # Seller's collateral deposit
  collateral_pct: f32             # Required collateral as % of remaining value

  # State
  status: ContractStatus
  created_at: u64
  activated_at: u64
  last_settlement_at: u64
  completed_at: u64

  # Signatures
  buyer_signature: bytes(2420)    # ML-DSA-87 buyer signature on terms
  seller_signature: bytes(2420)   # ML-DSA-87 seller signature on terms
```

### 5.3 Contract Lifecycle (State Machine)

```
States:
  Proposed      — Buyer has published proposal, awaiting seller
  Negotiation   — Counter-offer in progress
  Rejected      — Seller declined (terminal)
  Active        — Both parties signed, escrow/collateral locked
  Delivering    — At least one settlement has occurred
  Suspended     — Delivery paused (site offline, force majeure)
  Defaulted     — Under-delivery threshold breached
  Terminated    — Early termination (callable or mutual)
  Completed     — All volume delivered or term expired (terminal)

Transitions:
  Proposed     → Negotiation    [seller publishes counter-offer]
  Proposed     → Rejected       [seller publishes rejection]
  Proposed     → Active         [seller publishes acceptance + signature]
  Negotiation  → Proposed       [buyer publishes counter-counter]
  Negotiation  → Active         [accepting party signs]
  Active       → Delivering     [first settlement event]
  Active       → Terminated     [callable: buyer exercises call option]
  Delivering   → Delivering     [periodic settlement]
  Delivering   → Completed      [delivered_tco2e >= total_committed_tco2e OR end_date reached]
  Delivering   → Suspended      [site offline > 7 days, force majeure]
  Delivering   → Defaulted      [under-delivery > 30% for 2 consecutive periods]
  Suspended    → Delivering     [site back online]
  Defaulted    → Delivering     [makeup delivery restores schedule]
  Defaulted    → Terminated     [buyer exercises default termination]
  Terminated   → (terminal)     [collateral settlement, escrow return]
  Completed    → (terminal)     [collateral returned, final settlement]
```

### 5.4 Settlement Logic

**Trigger:** On each `sc.credits.issued` event (or monthly scheduler, configurable per contract)

**Settlement process (SmartCircuit compute graph):**

1. **Check active forwards** — Filter contracts where `status in [Active, Delivering]` and `project_id` matches the minted credit's project
2. **Priority ordering** — Oldest contract first (FIFO), then by price (highest forward price gets priority if multiple contracts compete for the same credits)
3. **Allocation** — Determine credits to allocate:
   - For `on_mint`: allocate up to the mint batch size
   - For `monthly/quarterly`: allocate pro-rata share of the period's minting
4. **Transfer** — Emit `TransferRequest` to Credit Registry (change owner from seller to buyer)
5. **Payment** — Debit buyer's escrow by `allocated_tco2e × price_per_tonne_usd`, credit to seller via `l2_operation.escrow_release`
6. **Update** — Increment `delivered_tco2e`, update `last_settlement_at`, check for completion
7. **Emit** — Publish settlement record to `sc.forwards.settlements.completed`

**Under-delivery detection:**

```
pro_rata_expected = total_committed_tco2e × (elapsed_months / term_months)
delivery_ratio = delivered_tco2e / pro_rata_expected
if delivery_ratio < 0.70 for 2 consecutive settlement periods:
  → transition to Defaulted
  → emit sc.forwards.risk.default_notice
```

**Over-delivery:** Credits minted beyond forward commitments are not auto-allocated. They remain with the seller for spot sale or additional forward contracts.

### 5.5 Escrow and Collateral

Both managed via eStream L2 operations (same pattern as marketplace orderbook):

**Buyer escrow:**
- On contract activation: buyer deposits `N months × monthly_commitment × price_per_tonne` into escrow (configurable prepay horizon, default 3 months)
- On each settlement: escrow debited
- When escrow runs low (< 1 month remaining): emit `sc.forwards.risk.escrow_low` for buyer to top up
- On completion/termination: unused escrow returned

**Seller collateral:**
- On contract activation: seller deposits `collateral_pct × remaining_contract_value`
- On each settlement: collateral requirement decreases proportionally
- On default: `default_penalty_pct × collateral` forfeits to buyer
- On completion: full collateral returned

### 5.6 Callable Option

For callable forward contracts:
- Buyer pays `call_premium_pct` upfront (non-refundable)
- Buyer can terminate at any time with `call_notice_days` notice
- Early termination triggers `call_penalty_pct × remaining_value` penalty from buyer escrow to seller
- Seller collateral returned in full (buyer initiated the termination)

---

## 6. Risk Monitoring (StreamSight)

### 6.1 Per-Contract Risk Score

Published to `sc.forwards.risk.delivery`:

```yaml
ContractRiskScore:
  contract_id: bytes(32)
  risk_score: u8                  # 0-100 (0 = no risk, 100 = certain default)
  delivery_ratio: f32             # delivered / expected
  forecast_delivery_ratio: f32    # AI forecast for remaining term
  escrow_months_remaining: f32    # Buyer escrow coverage
  collateral_coverage_pct: f32    # Seller collateral / remaining value
  site_health_score: u8           # From tenant fleet data (0-100)
  days_since_last_mint: u16       # Staleness indicator
  risk_factors:
    - factor: string(64)
    - weight: f32
    - value: f32
```

**Risk score calculation:**

```
risk_score = w1 × (1 - delivery_ratio)        # Under-delivery
           + w2 × (1 - forecast_ratio)         # AI forecasts shortfall
           + w3 × max(0, 1 - escrow_months/3)  # Low escrow
           + w4 × max(0, 1 - collateral/req)   # Low collateral
           + w5 × (1 - site_health/100)         # Site problems
           + w6 × min(1, days_no_mint / 30)     # Stale minting

where w1..w6 are configurable weights (default: 0.25, 0.20, 0.15, 0.15, 0.15, 0.10)
```

### 6.2 Portfolio Risk

Published to `sc.forwards.risk.portfolio`:

```yaml
PortfolioRisk:
  total_contracts: u32
  total_committed_tco2e: f64
  total_delivered_tco2e: f64
  total_value_usd: f64
  weighted_avg_risk_score: f32
  contracts_at_risk: u32           # risk_score > 50
  contracts_defaulted: u32
  total_escrow_locked_usd: f64
  total_collateral_locked_usd: f64
  concentration_risk:
    - { tenant_id: string, pct_of_total: f32 }
    - { methodology_id: string, pct_of_total: f32 }
```

### 6.3 Alert Topics

| Topic | Trigger | Severity |
|-------|---------|----------|
| `sc.forwards.risk.delivery_warning` | risk_score > 50 | warning |
| `sc.forwards.risk.default_notice` | Under-delivery threshold breached | critical |
| `sc.forwards.risk.escrow_low` | Escrow < 1 month coverage | warning |
| `sc.forwards.risk.collateral_call` | Collateral < required minimum | critical |
| `sc.forwards.market.basis_alert` | Basis exceeds 2-sigma | info |
| `sc.ai.alerts.yield_deviation` | Actual vs. forecast >20% for 48h | warning |

---

## 7. Lex Topic Hierarchy (Complete)

```
sc.
├── ai.                                # AI Forecasting
│   ├── forecasts.
│   │   ├── yield.{tenant}.{project}   # Per-project yield forecast
│   │   ├── yield.{tenant}.fleet       # Fleet aggregate forecast
│   │   ├── seasonal.{tenant}          # Seasonal decomposition
│   │   ├── capacity.{tenant}.{project} # Capacity factor projection
│   │   └── price.
│   │       └── forward_curve          # Forward price curve (all tenors)
│   ├── accuracy.
│   │   ├── yield.mae_7d               # 7-day mean absolute error
│   │   ├── yield.mape_30d             # 30-day mean absolute % error
│   │   ├── yield.mape_90d             # 90-day mean absolute % error
│   │   ├── yield.r_squared            # Trend R²
│   │   └── price.forward_vs_spot      # Forward price accuracy
│   ├── alerts.
│   │   └── yield_deviation            # >20% deviation for 48h+
│   ├── corpus.
│   │   ├── ingestion                  # Corpus ingestion rate
│   │   ├── sample_count               # Total samples
│   │   └── model_version              # Current model checkpoint
│   └── feedback                       # RLHF operator corrections
│
├── forwards.                          # Forward Contracts
│   ├── propose                        # Buyer → contract proposal
│   ├── counter                        # Seller → counter-offer
│   ├── accept                         # Party → acceptance + signature
│   ├── terminate                      # Party → termination request
│   ├── contracts.
│   │   ├── active                     # Active contract state
│   │   ├── proposed                   # Pending proposals
│   │   ├── completed                  # Completed contracts
│   │   └── defaulted                  # Defaulted contracts
│   ├── settlements.
│   │   ├── completed                  # Settlement events
│   │   ├── scheduled                  # Upcoming settlements
│   │   └── failed                     # Failed settlements
│   ├── risk.
│   │   ├── delivery                   # Per-contract risk score
│   │   ├── portfolio                  # Aggregate portfolio risk
│   │   ├── delivery_warning           # Risk > 50 alert
│   │   ├── default_notice             # Default triggered
│   │   ├── escrow_low                 # Escrow < 1 month
│   │   └── collateral_call            # Collateral margin call
│   └── market.
│       ├── basis                      # Forward vs. spot spread
│       └── basis_alert                # Basis exceeds 2-sigma
│
└── external.                          # External data ingestion
    └── weather                        # Weather data (ingested from API)
```

---

## 8. Console Widgets (estream-app)

All widgets subscribe to lex topics — no API calls:

| Widget | Lex Topic Subscriptions | Description |
|--------|------------------------|-------------|
| **Yield Forecast Chart** | `sc.ai.forecasts.yield.{tenant}.*` | 365-day projected minting with 80%/95% confidence bands |
| **Forward Curve** | `sc.ai.forecasts.price.forward_curve` | Interactive price curve across 8 tenors |
| **Contract Portfolio** | `sc.forwards.contracts.active` | Active contracts with delivery progress bars |
| **Delivery Monitor** | `sc.forwards.settlements.completed`, `sc.forwards.contracts.active` | Real-time delivered vs. committed gauge per contract |
| **Risk Heatmap** | `sc.forwards.risk.delivery`, `sc.forwards.risk.portfolio` | Portfolio risk across tenors and counterparties |
| **Forecast Accuracy** | `sc.ai.accuracy.*` | Historical forecast vs. actual minting overlay |
| **Basis Chart** | `sc.forwards.market.basis` | Forward vs. spot spread time series |
| **Contract Negotiation** | `sc.forwards.propose`, `sc.forwards.counter` | Proposal/counter-offer flow (publishes to lex topics) |

---

## 9. Integration with Existing SmartCircuits

| Existing Circuit | Connection | Direction | Description |
|-----------------|------------|-----------|-------------|
| **Credit Registry** | `sc.credits.issued` | → Yield Forecaster | Minting events feed corpus |
| **Credit Registry** | `sc.credits.issued` | → Forward Contracts | Mint triggers settlement check |
| **Credit Registry** | `TransferRequest` | Forward Contracts → | Settlement transfers ownership |
| **Marketplace Orderbook** | `sc.marketplace.market_data` | → Pricing Oracle | Spot prices feed forward pricing |
| **Marketplace Orderbook** | `sc.ai.forecasts.price.forward_curve` | Pricing Oracle → | Forward curve informs spot pricing |
| **PoVCR Verifier** | `sc.attestations.verified` | → Yield Forecaster | Attestation rate feeds corpus |
| **Retirement Engine** | existing triggers | Forward buyer → | Buyer can set retirement triggers on delivered credits |
| **Audit Trail** | `sc.audit.events` | All new circuits → | All contract + AI events logged |
| **Impact Widget** | `sc.forwards.settlements.completed` | Forward Contracts → | Forward deliveries count toward impact |

---

## 10. Cross-References

### Spec Collections

| Collection | Path | Description |
|-----------|------|-------------|
| [AI Forecasting](specs/ai-forecasting/SPEC.md) | specs/ai-forecasting/ | Structured reference for yield forecaster + pricing oracle |
| [Forward Contracts](specs/forward-contracts/SPEC.md) | specs/forward-contracts/ | Structured reference for contract engine + settlement |
| [AI Forecasting Patents](specs/ai-forecasting/PATENTS.md) | specs/ai-forecasting/ | Patent claim-to-feature mapping |
| [Forward Contracts Patents](specs/forward-contracts/PATENTS.md) | specs/forward-contracts/ | Patent claim-to-feature mapping |

### Related Documents

| Document | Repo | Purpose |
|----------|------|---------|
| [DESIGN.md](DESIGN.md) | povc-carbon | Platform architecture |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | povc-carbon | 9-phase build plan |
| [specs/INDEX.md](specs/INDEX.md) | povc-carbon | Spec collections master index |
| [PORTFOLIO-REVIEW.md](../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md) | synergythermogen | Patent portfolio (Cluster C patents) |
| [ESCIR_ML_EXTENSIONS.md](../../../toddrooke/estream-io/specs/protocol/ESCIR_ML_EXTENSIONS.md) | estream-io | Tensor types, SSM primitives |
| [trend-detector.escir.yaml](../../../toddrooke/estream-io/circuits/ops/trend-detector.escir.yaml) | estream-io | Online regression pattern |
| [TZ-AI-SPEC.md](../../../thermogenzero/microgrid/docs/TZ-AI-SPEC.md) | TZ microgrid | TZ AI corpus/training patterns |
| [ESTREAM_MARKETPLACE_SPEC.md](../../../toddrooke/estream-io/specs/marketplace/ESTREAM_MARKETPLACE_SPEC.md) | estream-io | esf-carbon schemas, marketplace |
