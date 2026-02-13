# AI Forecasting — Patent Cross-Reference

> **Spec Collection:** ai-forecasting  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `ai-carbon-yield-forecasting` — Cluster C (HIGH)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/ai-carbon-yield-forecasting/` (planned)

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| SSM/Mamba model for carbon yield prediction | Mamba/S4 SSM with BitNet b1.58 ternary weights | `yield_forecaster` — ssm_inference node |
| Multi-modal corpus from lex topic subscriptions | 8 data sources ingested via lex topics (no ETL) | `yield_forecaster` — corpus_store, feature_extractor nodes |
| Multi-horizon forecasting with confidence intervals | 7d/30d/90d/365d forecasts with 80%/95% CI | `yield_forecaster` — ssm_decoder, confidence_estimator nodes |
| RLHF operator corrections | Correction frames on `sc.ai.feedback`, weighted by tier | `yield_forecaster` — rlhf_integrator node |
| Continuous backtesting accuracy tracking | Rolling MAE, MAPE, R² published to StreamSight | `yield_forecaster` — backtest_engine node |
| Yield deviation alerts | >20% deviation for 48h triggers alert | `yield_forecaster` — deviation_detector node |

### `carbon-forward-pricing-oracle` — Cluster C (MEDIUM)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/carbon-forward-pricing-oracle/` (planned)

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Cost-of-carry model adapted for carbon credits | `F(T) = S * e^((r-y)*T)` with carbon-specific parameters | `forward_pricing_oracle` — carry_calculator node |
| AI supply adjustment using yield forecast | supply_factor from forecaster adjusts forward price | `forward_pricing_oracle` — supply_adjuster node |
| Vintage aging discount and methodology premium | Configurable premium/discount tables | `forward_pricing_oracle` — vintage_adjuster, methodology_adjuster nodes |
| 8-tenor forward curve with confidence propagation | Confidence from yield forecast propagated to price curve | `forward_pricing_oracle` — curve_builder, confidence_propagator nodes |
| Basis monitoring with anomaly detection | Forward-spot spread with 2-sigma alerting | `forward_pricing_oracle` — basis_calculator, basis_alert_detector nodes |

---

## Supporting Patents

### `povc-carbon-credit` — Cluster B (CRITICAL)

**Relevance:** AI forecasting depends on hardware-attested minting events. The quality of forecasts is directly tied to the trustworthiness of PoVC attestations.

### `multi-source-carbon-aggregation` — Cluster B (MEDIUM)

**Relevance:** Multi-source aggregation creates the heterogeneous corpus that the AI model trains on. Per-source yield forecasting depends on source identification.
