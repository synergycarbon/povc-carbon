# Marketplace Specification

> **Spec Collection:** marketplace  
> **Implementation Phase:** Phase 4 (Weeks 19-24)  
> **SmartCircuits:** `sc.marketplace.orderbook.v1`  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Section 6  
> **UI Reference:** [marketplace-ui/SPEC.md](../marketplace-ui/SPEC.md)  
> **Patent Reference:** [PATENTS.md](PATENTS.md)

---

## 1. Overview

The SynergyCarbon marketplace enables listing, discovery, and purchase of carbon credits. All marketplace operations are SmartCircuit-native — typed ESF frames on lex topics, Spark-authenticated. The marketplace backend is the `sc.marketplace.orderbook.v1` SmartCircuit; the frontend is a widget-based UI described in the [marketplace-ui/ spec](../marketplace-ui/SPEC.md).

---

## 2. Listing Model

Credit owners list credits for sale with:

- `listing_id` — Unique listing identifier
- `credit_ids` — Credits included (single or batch)
- `total_tonnes` — Total tCO2e offered
- `price_per_tonne` — Ask price (USD or ES token)
- `min_purchase` — Minimum purchase quantity
- `vintage_year`, `methodology`, `project_name` — Discovery metadata
- `expires_at` — Listing expiration

## 3. Discovery & Filtering

Buyers filter credits by: vintage year (range), credit type (Avoidance / Removal / Sequestration), methodology, source type (TEG, solar, wind, CCS), price range, project/region, verification confidence (%).

## 4. Settlement

1. Buyer places order via marketplace (publishes to `sc.marketplace.orders`)
2. Escrow: buyer funds locked in eStream payment channel (L2 operation)
3. Credit transferred: `owner` field updated to buyer
4. Funds released to seller via `l2_operation.escrow_release`
5. Both parties notified via lex topic events
6. StreamSight audit trail recorded

## 5. Market Data

Aggregated to `sc.marketplace.market_data`:
- Spot price (EWMA), 24h volume, bid-ask spread
- Price history by vintage, methodology, source type
- Consumed by AI Yield Forecaster and Forward Pricing Oracle

## 6. Fees

- Listing fee: 0.5% of sale (configurable via governance)
- Retirement fee: $0.10 per retirement

---

## 7. Lex Topics

```
sc.marketplace.
  listings.active         Active listings
  listings.completed      Filled/expired listings
  orders                  Order events
  market_data             Pricing, volume, trends
```

---

## 8. ESCIR Circuit

**Circuit file:** `circuits/marketplace/orderbook.escir.yaml`

---

## 9. Exit Criteria

- Credits can be listed, discovered, purchased, and settled
- Escrow protects both buyer and seller
- Market data published in real-time
- Listing fees collected correctly
