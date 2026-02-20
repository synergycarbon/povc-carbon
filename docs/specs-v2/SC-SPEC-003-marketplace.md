# SC-SPEC-003: Marketplace

> **Status**: Draft
> **Version**: 2.0.0
> **Date**: 2026-02-20
> **Scope**: Spot orderbook, forward contracts (9-state FSM), impact visualization, pricing, settlement
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)
> **Compliance**: EPA GHG, ISO 14064, Verra VCS, Gold Standard

---

## 1. Overview

The SynergyCarbon Marketplace enables trading of verified carbon credits through a spot orderbook and structured forward contracts. All participants must hold verified accounts (SC-SPEC-002). Every trade is compliance-gated, settlement is cryptographically witnessed, and the full trade provenance is Merkle-chained.

The marketplace also provides embeddable impact visualization widgets that allow corporate buyers to display their verified offset metrics on external websites — backed by real-time data from the registry.

---

## 2. Spot Marketplace

### 2.1 Order Types

| Type | Description |
|------|-------------|
| `LIMIT` | Buy or sell at a specified price or better |
| `MARKET` | Buy or sell at the best available price immediately |

All orders are denominated in USD per tCO2e. Minimum order size: 1 tCO2e.

### 2.2 Compliance Gate

Before an order is accepted:
1. Account verification status is confirmed (KYC/KYB complete)
2. Seller must hold sufficient ACTIVE credits of the specified vintage and methodology
3. Buyer must have sufficient escrowed funds or approved payment method
4. OFAC/sanctions check is current (< 24 hours)

Orders from non-compliant accounts are rejected with `COMPLIANCE_BLOCKED`.

### 2.3 Order Matching

Orders are matched using price-time priority:
1. Best price first (highest bid, lowest ask)
2. Earliest timestamp breaks ties
3. Partial fills are supported — remaining quantity stays on the book

Matched orders produce a `Trade` record and trigger settlement.

---

## 3. Order Book

### 3.1 Structure

```
OrderBook {
  instrument       : string             # e.g. "VCS-VM0006-2025" (methodology + vintage)
  bids             : SortedMap<price, Queue<Order>>
  asks             : SortedMap<price, Queue<Order>>
  last_trade_price : float64
  last_trade_time  : uint64
}
```

### 3.2 Real-Time Distribution

Order book updates are streamed via WebTransport on lex topic `sc.marketplace.orderbook.{instrument}`:
- `DEPTH_UPDATE`: bid/ask depth changes
- `TRADE`: executed trade notification
- `BOOK_SNAPSHOT`: periodic full snapshot (every 60s)

Clients subscribe with the eStream transport SDK. Depth chart rendering is handled by the `sc-depth-chart` Console Kit widget.

---

## 4. Forward Contracts

### 4.1 Nine-State FSM

```
DRAFT → NEGOTIATING → AGREED → ACTIVE → DELIVERING → DELIVERED → SETTLING → SETTLED
                                                                               ↓
                                                                        EXPIRED/DEFAULTED
```

| State | Description | Transitions |
|-------|-------------|-------------|
| `DRAFT` | Contract created by one party | → NEGOTIATING |
| `NEGOTIATING` | Terms being exchanged between parties | → AGREED, → EXPIRED |
| `AGREED` | Both parties have signed terms | → ACTIVE |
| `ACTIVE` | Contract is live, delivery period has begun | → DELIVERING |
| `DELIVERING` | Credits are being delivered against the schedule | → DELIVERED, → DEFAULTED |
| `DELIVERED` | All deliverables confirmed received | → SETTLING |
| `SETTLING` | Payment and final reconciliation in progress | → SETTLED, → DEFAULTED |
| `SETTLED` | Contract fully complete, all obligations met | Terminal |
| `EXPIRED/DEFAULTED` | Contract expired during negotiation or party defaulted | Terminal |

### 4.2 Contract Terms

```
ForwardContract {
  contract_id      : UUID v7
  buyer            : account_id
  seller           : account_id
  instrument       : string             # methodology + vintage
  volume_tco2e     : float64            # Total contracted volume
  price_per_tonne  : float64            # USD
  delivery_schedule: DeliveryMilestone[]
  delivery_tolerance: float64           # Acceptable variance (e.g. 0.05 = ±5%)
  penalty_clauses  : PenaltyClause[]
  effective_date   : uint64
  expiry_date      : uint64
  state            : ForwardContractState
  signatures       : ML-DSA-87[]        # Both parties + registry witness
}
```

### 4.3 Delivery Schedule

```
DeliveryMilestone {
  milestone_id     : uint32
  due_date         : uint64
  volume_tco2e     : float64
  delivered        : float64            # Actual delivered (updated on delivery)
  status           : enum(PENDING, DELIVERED, PARTIAL, OVERDUE)
}
```

### 4.4 Penalty Clauses

```
PenaltyClause {
  trigger          : enum(LATE_DELIVERY, SHORT_DELIVERY, NON_DELIVERY)
  threshold_days   : uint32             # Grace period
  penalty_rate     : float64            # Percentage of milestone value
  max_penalty      : float64            # Cap in USD
}
```

---

## 5. Settlement

### 5.1 Spot Settlement

Immediate upon trade execution:
1. Credits transferred from seller → buyer (via SC-SPEC-002 transfer primitive)
2. Funds transferred from buyer escrow → seller account
3. Trade fee deducted (see Section 7)
4. Settlement confirmation published to both parties

### 5.2 Forward Settlement

Triggered per delivery milestone:
1. Seller delivers credits matching milestone volume (within tolerance)
2. Registry validates credit vintage, methodology, and PoVCR provenance
3. Buyer confirms receipt
4. Payment released for the milestone amount
5. Partial delivery: pro-rata payment, remainder due at next milestone

Automatic settlement occurs when verified delivery matches the milestone within tolerance. Disputes trigger a manual review process via the governance module (SC-SPEC-004).

---

## 6. Impact Visualization

### 6.1 Embeddable Widget

The `sc-impact-counter` widget displays real-time offset metrics for a given account or project:

```html
<estream-widget
  type="sc-impact-counter"
  project-id="thermogenzero-001"
  theme="dark"
  show-live-meter="true"
/>
```

### 6.2 Widget Features

| Feature | Description |
|---------|-------------|
| **Live counter** | Animated tCO2e offset total, updating in real-time from registry |
| **Certificate link** | Click-through to verify retirement certificates |
| **Provenance badge** | "PoVC Verified" badge with Merkle proof link |
| **Leaderboard** | Optional ranking of offset contributors |
| **Time series** | Monthly offset trend chart |

### 6.3 Data Source

Widgets subscribe to the registry fan-up aggregate via WebTransport. Data is read-only and contains no PII or sensitive project details — only public offset metrics.

---

## 7. Pricing

| Fee Type | Rate | Applied To |
|----------|------|------------|
| Spot trade fee | 0.5% of trade value | Each executed spot trade |
| Forward contract fee | 0.5% of total contract value | On contract activation (AGREED → ACTIVE) |
| Retirement fee | $0.10 per credit | Each retirement event |
| Impact widget | Free | Included with account |

Fees are deducted automatically at settlement. Volume discounts available for accounts exceeding 10,000 tCO2e/month (negotiated bilaterally).

---

## 8. Graph Model — marketplace_orderbook

### 8.1 Node Types

| Node | Description | Key Fields |
|------|-------------|------------|
| `Order` | Buy or sell order | order_id, side, price, quantity, status |
| `Trade` | Executed match between orders | trade_id, price, quantity, timestamp |
| `ForwardContract` | Structured delivery agreement | contract_id, state, volume, price_per_tonne |
| `ImpactMetric` | Aggregated offset metric for visualization | project_id, total_offset, period |

### 8.2 Edge Types

| Edge | From → To | Semantics |
|------|-----------|-----------|
| `places` | Account → Order | Account submits an order |
| `matches` | Order → Trade | Order matched into a trade |
| `settles` | Trade → Credit (via transfer) | Trade triggers credit transfer |
| `visualizes` | ImpactMetric → Account | Impact metric displayed for account |

### 8.3 Overlays

| Overlay | Scope | Description |
|---------|-------|-------------|
| `depth` | Per-instrument | Current bid/ask depth at each price level |
| `volume` | Per-instrument | Rolling 24h traded volume |
| `price_trend` | Per-instrument | 7/30/90-day price moving averages |
| `forward_curve` | Per-methodology | Forward price curve from active contracts |

### 8.4 AI Feed

| Feed | Description |
|------|-------------|
| `price_prediction` | 7-day price forecast per instrument using ESLM model trained on historical trades, verification volume, and macro carbon market data |
| `volume_forecast` | Predicted monthly issuance volume per project, informed by hardware telemetry trends and seasonal patterns |

AI feeds are advisory only. They are not used in automated trading or settlement decisions.

---

## 9. Lex Integration

```
esn/sustainability/carbon/org/synergycarbon/
  marketplace/
    orderbook/             # Active orders, depth snapshots
    trades/                # Executed trade records
    forwards/              # Forward contract lifecycle events
    impact/                # Public impact metrics for widgets
    analytics/             # Pricing trends, volume aggregates
```

---

## 10. Security Considerations

- **Front-running prevention**: Orders are timestamped at the transport layer before reaching the matching engine; no participant sees pending orders before publication
- **Escrow enforcement**: Buyer funds are escrowed before order acceptance; seller credits are reserved before listing
- **Forward contract signatures**: Both parties and the registry co-sign with ML-DSA-87 at the AGREED transition
- **Widget data isolation**: Impact widgets serve only public aggregate data; no account balances, trade history, or PII is exposed

---

## References

- [SC-SPEC-001](SC-SPEC-001-verification-pipeline.md) — Verification Pipeline (credit provenance)
- [SC-SPEC-002](SC-SPEC-002-credit-registry.md) — Credit Registry (credit lifecycle, transfers)
- [SC-SPEC-004](SC-SPEC-004-governance.md) — Governance (dispute resolution, methodology)
- [DESIGN.md](../DESIGN.md) — Platform design narrative
- [AI_FORWARD_CONTRACTS_SPEC.md](../AI_FORWARD_CONTRACTS_SPEC.md) — Detailed forward contract AI spec
