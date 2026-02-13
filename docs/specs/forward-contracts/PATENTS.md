# Forward Contracts — Patent Cross-Reference

> **Spec Collection:** forward-contracts  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `forward-carbon-credit-contracts` — Cluster C (HIGH)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/forward-carbon-credit-contracts/` (planned)

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Carbon PPA forward contracts with 9-state FSM | Contract lifecycle (Proposed -> Completed) | `forward_contracts` — contract_store, negotiation_handler nodes |
| Settlement triggered by credit minting events | Auto-settlement on `sc.credits.issued` | `forward_contracts` — forward_matcher, credit_allocator nodes |
| FIFO priority allocation for competing contracts | Oldest contract first, then highest price | `forward_contracts` — priority_sorter node |
| Under-delivery detection with pro-rata calculation | delivery_ratio < 0.70 for 2 periods -> Default | `forward_contracts` — under_delivery_detector node |
| L2 escrow and collateral management | Buyer escrow lock/release, seller collateral | `forward_contracts` — buyer_escrow_lock, seller_collateral_lock nodes |
| Callable option with notice period and penalty | Call premium, termination penalty, notice days | `forward_contracts` — callable_penalty_calculator node |

### `streaming-carbon-settlement` — Cluster C (MEDIUM)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/streaming-carbon-settlement/` (planned)

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| Real-time settlement on each credit mint | Event-driven vs. batch settlement | `forward_contracts` — `on_mint` settlement_frequency |
| Priority allocation algorithm | FIFO by age, then by price | `forward_contracts` — priority_sorter node |
| Streaming escrow debit on each settlement | Buyer escrow decremented per delivery | `forward_contracts` — settlement_payment node |
| Real-time delivery tracking with completion % | delivered_tco2e / total_committed ratio | `forward_contracts` — delivery_tracker, completion_checker nodes |
| Over-delivery handling | Excess remains with seller for spot sale | `forward_contracts` — credit_allocator (cap at committed volume) |

---

## Supporting Patents

### `ai-carbon-yield-forecasting` — Cluster C (HIGH)

**Relevance:** Forward contract risk scoring uses AI yield forecasts to project remaining delivery capability. The `forecast_delivery_ratio` in risk scores comes from the yield forecaster.

### `carbon-forward-pricing-oracle` — Cluster C (MEDIUM)

**Relevance:** The oracle provides the reference forward curve used when contracts are struck. `oracle_price_at_execution` is recorded in each contract.
