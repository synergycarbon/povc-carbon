# SC-SPEC-006: AI Analytics

> **Status**: Draft
> **Scope**: Mamba/S4 SSM yield forecasting, forward pricing oracle, risk monitoring, carbon yield prediction
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)

---

## 1. Overview

The AI Analytics subsystem provides predictive intelligence for the SynergyCarbon platform. It consists of three integrated engines — **Yield Forecasting**, **Forward Pricing Oracle**, and **Risk Monitoring** — each implemented as eStream SmartCircuits operating on verified credit data flowing through lex topics.

All models use **Mamba/S4 State Space Model** architecture for time-series prediction, trained via ESLM continuous learning on the corpus of verified carbon credit telemetry. Every prediction carries a confidence interval and full training data lineage, ensuring auditability from forecast back to source sensor.

**SmartCircuits:**
- `sc.ai.yield_forecaster.v1` — Carbon yield prediction across 5 horizons
- `sc.ai.forward_pricing_oracle.v1` — Forward curve generation and spot price modeling
- `sc.ai.risk_monitor.v1` — Multi-dimensional risk assessment

---

## 2. Yield Forecasting Engine

### 2.1 Model Architecture

| Property | Value |
|----------|-------|
| **Base model** | Mamba/S4 SSM (State Space Model) |
| **Weights** | BitNet b1.58 ternary quantization |
| **Hidden dim** | 512 |
| **State dim** | 64 |
| **Layers** | 8 Mamba blocks with residual connections |
| **Context window** | 8,760 observation steps (1 year at hourly resolution) |
| **Training mix** | 0.4 inference feedback / 0.6 operational corpus |
| **Retrain trigger** | Every 5,000 verified credit samples |
| **Inference cadence** | Hourly forecast refresh |
| **RLHF** | Operator corrections weighted by experience tier |

### 2.2 Input Features

All inputs are ingested via lex topic subscriptions:

| Source | Lex Topic | Features Extracted |
|--------|-----------|-------------------|
| Historical generation | `tz.teg.power` | Power output, capacity factor, degradation trend |
| Weather forecasts | `sc.external.weather` | Temperature, wind speed, irradiance, precipitation |
| Gas flow projections | `tz.carbon.accrual.*` | Gas flow rate, CH4 mass, net CO2e |
| Seasonal patterns | `sc.ai.forecasts.seasonal.*` | Hour/day/month cyclical encodings |
| Credit minting history | `sc.credits.issued` | Minting rate, batch size, vintage distribution |
| Spot market data | `sc.marketplace.market_data` | Price EWMA, volume, bid-ask spread |
| Attestation throughput | `sc.attestations.verified` | Verification rate, quorum success ratio |
| Forward commitments | `sc.forwards.contracts.active` | Committed volume, delivery schedule pressure |

### 2.3 Feature Vector (20 features per observation window)

```
Power features (4):    power_mean, trend_slope, r_squared, capacity_factor
Carbon features (4):   minting_rate, gas_flow, ch4_mass, attestation_success_rate
Market features (3):   spot_price, volume_24h, forward_committed_pct
Weather features (4):  ambient_temp, wind_speed, irradiance, precipitation
Calendar features (5): hour_sin, hour_cos, day_sin, day_cos, is_weekend
```

### 2.4 Prediction Horizons

| Horizon | Resolution | Primary Use Case |
|---------|-----------|------------------|
| **24h** | Hourly | Operational planning, spot market timing |
| **7d** | 6-hour | Short-term delivery scheduling |
| **30d** | Daily | Forward contract pricing, capacity planning |
| **90d** | Weekly | Quarterly commitment sizing |
| **1y** | Monthly | Strategic planning, annual commitment contracts |

### 2.5 Confidence Scoring

Every prediction includes:

- **Point estimate** — Best-case yield in tCO2e
- **Confidence interval** — 80% and 95% bands
- **Training data lineage** — Hash of the corpus snapshot used for inference
- **Model version** — SmartCircuit version + weight checkpoint ID
- **Staleness indicator** — Hours since last retrain relative to new data volume

Confidence is computed as the calibrated prediction interval from the SSM's state uncertainty propagation. Intervals widen for longer horizons and sparse-data regimes.

---

## 3. Forward Pricing Oracle

### 3.1 Price Curve Generation

The oracle produces forward price curves by combining:

1. **Cost-of-carry model** — Storage cost (lex storage fees), time value of capital, insurance
2. **AI supply adjustment** — Yield forecast feeds expected supply; scarcity premium when forecast < committed
3. **Market sentiment** — Bid-ask spread trend, order book depth, recent trade velocity
4. **Methodology premium** — Credits from hardware-attested sources command premium over self-reported

### 3.2 Output Curves

| Curve | Tenors | Update Rate | Lex Topic |
|-------|--------|-------------|-----------|
| Spot price | T+0 | Real-time (per trade) | `sc.ai.pricing.spot` |
| Near-term forward | 1d, 7d, 14d, 30d | Hourly | `sc.ai.pricing.forward.near` |
| Term forward | 60d, 90d, 180d, 365d | Daily | `sc.ai.pricing.forward.term` |
| Vintage curve | By vintage year | Daily | `sc.ai.pricing.vintage` |

### 3.3 Price Point Structure

```
PricePoint {
  tenor_days:       u32,
  price_per_tonne:  u64,        // fixed-point 6 decimals (USD)
  confidence_low:   u64,
  confidence_high:  u64,
  supply_forecast:  u64,        // expected available tCO2e
  demand_signal:    f32,        // normalized 0.0–1.0
  methodology:      String,     // methodology filter (or "all")
  generated_at:     Timestamp,
  model_version:    String,
}
```

---

## 4. Risk Monitoring

### 4.1 Risk Dimensions

| Risk Type | Description | Indicators |
|-----------|-------------|------------|
| **Counterparty risk** | Buyer/seller default probability | Payment history, contract completion rate, Spark reputation score |
| **Delivery risk** | Probability of under-delivery on forward contracts | Yield forecast vs. committed volume, site health, weather outlook |
| **Market risk** | Price volatility and liquidity risk | Historical volatility, bid-ask spread, order book depth |
| **Methodology risk** | Regulatory or methodology invalidation | Governance proposal activity, compliance flag density, registry status |

### 4.2 Risk Scoring

Each risk dimension produces a score on a 0–100 scale:

| Range | Label | Action |
|-------|-------|--------|
| 0–25 | Low | No action required |
| 26–50 | Moderate | Monitor; flag in console |
| 51–75 | Elevated | Alert owner; suggest mitigation |
| 76–100 | Critical | Pause new commitments; escalate to governance |

Composite risk score = weighted average across dimensions, with weights configurable per tenant.

### 4.3 Risk Alert Pipeline

```
RiskMetric (computed hourly)
  → threshold check (per-dimension)
    → if exceeded: emit to sc.ai.risk.alerts.{tenant}
      → Console widget subscription (risk-monitor)
      → Webhook: risk.threshold_exceeded (if B2B API configured)
```

---

## 5. Graph Model

### 5.1 Node Types (`ai_analytics` graph)

| Node Type | Description | Key Fields |
|-----------|-------------|------------|
| `ForecastModel` | A trained model checkpoint | `model_id`, `version`, `architecture`, `training_corpus_hash`, `trained_at`, `sample_count` |
| `PricePoint` | A single price observation or prediction | `tenor_days`, `price_per_tonne`, `confidence_low`, `confidence_high`, `generated_at` |
| `RiskMetric` | A computed risk score | `risk_type`, `score`, `label`, `indicators`, `computed_at` |
| `YieldCurve` | A multi-horizon yield forecast | `horizons[]`, `point_estimates[]`, `confidence_intervals[]`, `model_id`, `generated_at` |

### 5.2 Edge Types

| Edge | From | To | Semantics |
|------|------|----|-----------|
| `predicts` | ForecastModel | YieldCurve | Model produced this forecast |
| `prices` | YieldCurve | PricePoint | Yield forecast feeds pricing |
| `assesses` | RiskMetric | PricePoint \| YieldCurve | Risk evaluation of a forecast or price |
| `updates` | ForecastModel | ForecastModel | Model retrain lineage (v1 → v2) |

### 5.3 Overlays

| Overlay | Applied To | Type | Description |
|---------|-----------|------|-------------|
| `prediction_confidence` | YieldCurve, PricePoint | `f32` | Calibrated confidence score (0.0–1.0) |
| `price_trend` | PricePoint | `enum` | `rising`, `stable`, `falling` based on 7d moving average |
| `risk_score` | RiskMetric | `u8` | Composite risk score (0–100) |

---

## 6. AI Feed Definitions

Feeds are lex topic streams consumed by Console widgets and B2B API subscribers.

### 6.1 `yield_prediction`

| Property | Value |
|----------|-------|
| **Lex topic** | `sc.ai.forecasts.yield.{tenant}.{project}` |
| **Update rate** | Hourly |
| **Payload** | `YieldCurve` node (all horizons) |
| **Consumers** | yield-forecast widget, forward-contracts widget, B2B API |

### 6.2 `forward_curve`

| Property | Value |
|----------|-------|
| **Lex topic** | `sc.ai.pricing.forward.*` |
| **Update rate** | Hourly (near-term), daily (term) |
| **Payload** | Array of `PricePoint` nodes per tenor |
| **Consumers** | pricing-oracle widget, marketplace widget, B2B API |

### 6.3 `risk_assessment`

| Property | Value |
|----------|-------|
| **Lex topic** | `sc.ai.risk.{tenant}.{dimension}` |
| **Update rate** | Hourly |
| **Payload** | `RiskMetric` node with indicator breakdown |
| **Consumers** | risk-monitor widget, governance widget, B2B webhook |

---

## 7. ESLM Continuous Learning

### 7.1 Training Pipeline

```
Verified credit data (sc.credits.issued, sc.attestations.verified)
  → Corpus accumulator (lex topic → training buffer)
    → Threshold check: 5,000 new verified samples
      → Trigger retrain of yield_forecaster + forward_pricing_oracle
        → Validation on holdout set (last 10% of samples)
          → If accuracy improved: promote to active
          → If degraded: retain current, flag for review
```

### 7.2 Model Governance

- All model checkpoints are stored as scatter-cas blobs with content-addressed hashes
- Retrain lineage tracked via `updates` edges in the `ai_analytics` graph
- Governance SmartCircuit can pause a model version if anomaly detected
- Rollback: revert to previous checkpoint by updating the active model pointer

---

## 8. Integration Points

| System | Integration | Direction |
|--------|-------------|-----------|
| Credit Registry | Minting data feeds yield model | Registry → AI |
| Marketplace | Forward curves feed order matching | AI → Marketplace |
| Forward Contracts | Yield forecasts feed commitment sizing | AI → Contracts |
| Console | Widgets subscribe to all three feeds | AI → Console |
| B2B API | Endpoints expose forecasts, curves, risk | AI → API |
| Governance | Methodology changes trigger model re-evaluation | Governance → AI |
| ThermogenZero | Tenant telemetry feeds feature extraction | TZ → AI |

---

## 9. Security & Privacy

- All model weights stored encrypted at rest (AES-256-GCM)
- Inference requests authenticated via Spark identity
- Tenant data isolation: each tenant's features stored in isolated lex namespaces
- No cross-tenant model training without explicit opt-in and governance approval
- Prediction outputs inherit the visibility tier of the underlying credit data
- ML-DSA-87 signatures on all published forecasts and price curves
