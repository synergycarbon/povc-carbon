# AI Forecasting & Pricing Oracle Specification

> **Spec Collection:** ai-forecasting  
> **Implementation Phase:** Phase 7 (Weeks 37-44)  
> **SmartCircuits:** `sc.ai.yield_forecaster.v1`, `sc.ai.forward_pricing_oracle.v1`  
> **Design Reference:** [AI_FORWARD_CONTRACTS_SPEC.md](../../AI_FORWARD_CONTRACTS_SPEC.md) Sections 3-4  
> **Patent Reference:** [PATENTS.md](PATENTS.md)  
> **ESCIR Version:** 0.8.1 — both circuits verified complete (16 + 11 compute nodes)

---

## 1. Overview

The AI forecasting subsystem predicts future carbon credit minting volume and computes fair forward prices. It consists of two SmartCircuits:

1. **Yield Forecaster** — Mamba/S4 SSM model predicting tCO2e minting across 4 horizons
2. **Forward Pricing Oracle** — Combines cost-of-carry, AI supply adjustment, and premiums into a forward curve

Both are eStream-native: corpus ingestion from lex topics, inference in estream-kernel, outputs to lex topics.

---

## 2. Yield Forecaster

### 2.1 Model Architecture

- **Base:** Mamba/S4 SSM (State Space Model) — long-range time-series dependencies
- **Weights:** BitNet b1.58 ternary — compact, efficient inference
- **Training:** 0.4 inference feedback / 0.6 operational corpus; retrain every 5,000 samples
- **Inference:** Hourly forecast refresh
- **RLHF:** Operator corrections weighted by experience tier

### 2.2 Corpus Ingestion (All via Lex Topics)

| Source | Lex Topic | Feature Extraction |
|--------|-----------|-------------------|
| Credit minting | `sc.credits.issued` | Minting rate, batch size, vintage |
| Spot pricing | `sc.marketplace.market_data` | Price EWMA, volume, bid-ask |
| Attestation rate | `sc.attestations.verified` | Verification throughput, quorum success |
| Tenant power | `tz.teg.power` | Power output, capacity factor |
| Carbon accrual | `tz.carbon.accrual.*` | Gas flow, CH4 mass, net CO2e |
| Fleet health | `tz.fleet.*` | Active sites, degraded sites, capacity |
| Weather | `sc.external.weather` | Temperature, wind, irradiance |
| Forward contracts | `sc.forwards.contracts.active` | Committed volume, delivery pressure |

### 2.3 Feature Vector (18 features per observation window)

Power features (4): power_mean, trend_slope, r_squared, capacity_factor  
Carbon features (3): minting_rate, gas_flow, attestation_success_rate  
Market features (3): spot_price, volume_24h, forward_committed  
External features (3): ambient_temp, wind_speed, irradiance  
Calendar features (5): hour_sin, hour_cos, day_sin, day_cos, is_weekend

### 2.4 Forecast Outputs

| Output | Lex Topic | Update Rate |
|--------|-----------|-------------|
| Yield forecast | `sc.ai.forecasts.yield.{tenant}.{project}` | Hourly |
| Confidence intervals | (embedded in YieldForecast) | Hourly |
| Seasonal decomposition | `sc.ai.forecasts.seasonal.{tenant}` | Daily |
| Capacity factor | `sc.ai.forecasts.capacity.{tenant}.{project}` | Hourly |
| Fleet aggregate | `sc.ai.forecasts.yield.{tenant}.fleet` | Hourly |

### 2.5 Accuracy Tracking (StreamSight)

| Metric | Target |
|--------|--------|
| MAE (7d) | < 10% |
| MAPE (30d) | < 15% |
| MAPE (90d) | < 20% |
| R² (trend) | > 0.8 |

Deviation alerts fire when actual minting deviates >20% from forecast for 48+ hours.

---

## 3. Forward Pricing Oracle

### 3.1 Pricing Model (Three Signals)

**Signal 1: Cost-of-Carry**
```
F(T) = S * e^((r - y) * T)
  S = spot price (EWMA), r = risk-free rate (default 5%), y = convenience yield, T = time to delivery
```

**Signal 2: AI Supply Adjustment**
```
supply_factor = forecast_yield(T) / historical_avg_yield
adjusted_F(T) = F(T) * (1 / supply_factor)^elasticity    (elasticity = 0.3)
```

**Signal 3: Vintage and Methodology Premium**
```
vintage_premium = 1.0 + (-0.02) * (current_year - vintage_year)
methodology_premium = { EPA: 1.0, Verra: 1.15, Gold Standard: 1.20, CDM: 0.95 }
```

**Combined:** `ForwardPrice(T) = adjusted_F(T) * vintage_premium * methodology_premium`

### 3.2 Forward Curve

Published to `sc.ai.forecasts.price.forward_curve` with 8 tenors: 1m, 3m, 6m, 1y, 2y, 3y, 5y, lifetime. Each tenor includes price + 80% confidence bounds.

### 3.3 Basis Monitoring

- `sc.forwards.market.basis` — forward minus spot at each tenor (updated every minute)
- `sc.forwards.market.basis_alert` — alert when basis exceeds historical 2-sigma

---

## 4. ESCIR Circuits

- **Yield Forecaster:** `circuits/ai/yield_forecaster.escir.yaml`
- **Forward Pricing Oracle:** `circuits/ai/forward_pricing_oracle.escir.yaml`

---

## 5. Exit Criteria

- Yield forecaster producing hourly forecasts from TZ telemetry
- Forward curve published with 8 tenors
- Accuracy tracking operational (MAE, MAPE, R²)
- RLHF feedback loop accepting operator corrections
- Deviation alerts firing correctly
