# Forward Contracts Specification

> **Spec Collection:** forward-contracts  
> **Implementation Phase:** Phase 7 (Weeks 37-44)  
> **SmartCircuits:** `sc.marketplace.forward_contracts.v1`  
> **Design Reference:** [AI_FORWARD_CONTRACTS_SPEC.md](../../AI_FORWARD_CONTRACTS_SPEC.md) Sections 5-6  
> **Patent Reference:** [PATENTS.md](PATENTS.md)

---

## 1. Overview

The forward contract engine enables buyers to lock in a price for future carbon credits over a fixed term or project lifetime, with automated settlement as credits are minted. All interactions are SmartCircuit-native — typed ESF frames on lex topics, Spark-authenticated.

---

## 2. Contract Types

| Type | Term | Delivery | Use Case |
|------|------|----------|----------|
| **Fixed-Term** | 3m-5y | Monthly pro-rata | Corporate ESG budgets |
| **Project-Lifetime** | Full life | Continuous as minted | Long-term PPA |
| **Volume-Committed** | Until filled | As minted, up to total | "Buy 1000 tCO2e at $X" |
| **Callable** | Any + call option | Per underlying | Flexible demand |

---

## 3. Contract Lifecycle (9-State FSM)

```
Proposed -> Negotiation -> Active -> Delivering -> Completed
                                  -> Suspended -> Delivering
                                  -> Defaulted -> Terminated
Active -> Terminated (callable exercise)
```

Terminal states: Rejected, Completed, Terminated

### 3.1 Lex Topic Interaction Model

| Action | Topic | Publisher |
|--------|-------|-----------|
| Propose | `sc.forwards.propose` | Buyer |
| Counter-offer | `sc.forwards.counter` | Seller |
| Accept | `sc.forwards.accept` | Either party (ML-DSA-87 signed) |
| Terminate | `sc.forwards.terminate` | Either party |
| Settlement | Automated | SmartCircuit (on mint event) |

---

## 4. Settlement Logic

**Trigger:** On each `sc.credits.issued` event (or monthly scheduler per contract)

1. **Find matching contracts** — Filter active/delivering contracts by project + methodology
2. **Priority ordering** — FIFO by contract age, then by price
3. **Allocation** — Determine credits per contract (on_mint: batch size; monthly: pro-rata)
4. **Transfer** — Emit `TransferRequest` to Credit Registry (change owner)
5. **Payment** — Debit buyer escrow, credit seller via L2 escrow release
6. **Update** — Increment delivered_tco2e, check completion
7. **Emit** — Publish to `sc.forwards.settlements.completed`

### Under-Delivery Detection

```
pro_rata_expected = total_committed * (elapsed_months / term_months)
delivery_ratio = delivered / pro_rata_expected
if delivery_ratio < 0.70 for 2 consecutive periods -> Defaulted
```

---

## 5. Escrow and Collateral

**Buyer escrow:** Deposits N months prepayment; debited on each settlement; alert when < 1 month remaining.

**Seller collateral:** Deposits collateral_pct of remaining value; decreases with deliveries; forfeits on default.

Both managed via eStream L2 operations (`l2_operation.escrow_lock`, `l2_operation.escrow_release`).

---

## 6. Risk Monitoring (StreamSight)

| Metric | Lex Topic | Description |
|--------|-----------|-------------|
| Per-contract risk | `sc.forwards.risk.delivery` | 0-100 score from delivery, forecast, escrow, collateral, site health |
| Portfolio risk | `sc.forwards.risk.portfolio` | Aggregate across all contracts |
| Escrow alert | `sc.forwards.risk.escrow_low` | Buyer escrow < 1 month |
| Collateral call | `sc.forwards.risk.collateral_call` | Seller collateral below minimum |

---

## 7. ESCIR Circuit

**Circuit file:** `circuits/marketplace/forward_contracts.escir.yaml`

---

## 8. Exit Criteria

- Forward contract proposal -> acceptance -> settlement lifecycle complete
- Automated settlement on mint events
- Escrow and collateral L2 operations functional
- Under-delivery detection and default flow tested
- Risk monitoring published to StreamSight
