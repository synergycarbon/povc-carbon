# RBAC & Data Gateway Specification

> **Spec Collection:** rbac
> **Implementation Phase:** Phase 8 (cross-cutting)
> **Framework:** Console Kit (`@estream/sdk-browser/widgets`)
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Section 4.3 (Visibility Tiers)

---

## 1. Overview

The SynergyCarbon RBAC system maps the four visibility tiers from the credit NFT design to Console Kit roles, enforced by the WASM-backed WidgetDataGateway at runtime.

---

## 2. Visibility Tier → Console Kit Role Mapping

| Visibility Tier | Console Kit Role | Auth Required | Spark Actions | Token TTL |
|----------------|-----------------|---------------|---------------|-----------|
| Public | `public` | No | None | N/A |
| Buyer | `buyer` | Yes (Spark) | `place_order` | Session |
| Auditor | `auditor` | Yes (Spark) | None | 90 days |
| Owner | `owner` | Yes (Spark) | `retire_credits`, `governance_vote`, `sign_contract`, etc. | Session |

---

## 3. Field-Level Access Control

Each role defines an `allowed_fields` list. The WASM gateway strips unauthorized fields from Lex topic messages and ESLite query results before delivering to the widget.

### Public Fields
`credit_id`, `serial_number`, `vintage_year`, `tonnes_co2e`, `source_type`, `project_name`, `status`, `methodology_id`

### Buyer Fields (superset of Public)
Adds: `project_location`, `issued_at`, `evidence_hash`, `listing_id`, `price_usd`, `seller`, `contract_id`, `buyer`, `total_tonnes`, `delivered_tonnes`

### Auditor Fields (superset of Public)
Adds: `attestation_id`, `tenant_id`, `epoch_id`, `merkle_root`, `total_energy_wh`, `quorum_count`, `confidence`, `event_id`, `action`, `actor`, `timestamp`, `details`, `prev_event_hash`

### Owner Fields
All fields (`*`)

---

## 4. Spark Action Gates

High-value actions require ML-DSA-87 signatures via the Spark wire protocol:

| Action | Required Role | Confirmation UI | Circuit Target |
|--------|--------------|----------------|----------------|
| `retire_credits` | owner | Visual challenge | `sc.core.retirement_engine.v1` |
| `governance_vote` | owner | Visual challenge | `sc.governance.v1` |
| `sign_contract` | owner | Visual challenge | `sc.marketplace.forward_contracts.v1` |
| `cancel_listing` | owner | Simple confirm | `sc.marketplace.orderbook.v1` |
| `propose_methodology` | owner | Double confirm | `sc.governance.v1` |
| `register_verifier` | owner | Double confirm | `sc.governance.v1` |
| `place_order` | buyer | Simple confirm | `sc.marketplace.orderbook.v1` |
| `create_trigger` | owner | Simple confirm | `sc.core.retirement_engine.v1` |

---

## 5. Widget Data Scoping

Each widget declares its required lex topics, ESLite tables, and minimum role. The gateway enforces these at registration time and blocks any out-of-scope data access.

See: `console/src/rbac/gateway-config.ts` for the full per-widget scope definitions.

---

## 6. Cross-References

| Document | Purpose |
|----------|---------|
| [DESIGN.md](../../DESIGN.md) Section 4.3 | Visibility tier definitions |
| [roles.ts](../../../console/src/rbac/roles.ts) | TypeScript role definitions |
| [spark-actions.ts](../../../console/src/rbac/spark-actions.ts) | Spark action gate definitions |
| [gateway-config.ts](../../../console/src/rbac/gateway-config.ts) | Per-widget scoping rules |
