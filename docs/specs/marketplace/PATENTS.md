# Marketplace — Patent Cross-Reference

> **Spec Collection:** marketplace  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents

### `smartcircuit-carbon-marketplace` — Cluster C (MEDIUM)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/smartcircuit-carbon-marketplace/` (planned)

| Patent Claim | Platform Feature | Circuit / Code |
|-------------|-----------------|----------------|
| All marketplace operations as SmartCircuit I/O | Order placement, matching, settlement via lex topics | `marketplace_orderbook` — all nodes |
| Lex topic-based interaction model (no HTTP API) | Buyers/sellers publish typed ESF frames to `sc.marketplace.*` | Lex topic hierarchy |
| Spark-authenticated trading with ML-DSA-87 signed orders | Every order signed by buyer identity | `marketplace_orderbook` — order_validator node |
| WidgetDataGateway for RBAC-enforced data access | Real-time market data via `useWidgetData()` | `@estream/sdk-browser` widget gateway |
| Embeddable impact widgets via widget framework | Impact counter, certificate, live meter widgets | `impact_widget` circuit |

---

## Supporting Patents

### `povc-carbon-credit` — Cluster B (CRITICAL)

**Relevance:** Credits traded on the marketplace are PoVC-verified. The marketplace inherits the verification guarantee.

### `provenance-chain` — Cluster B (HIGH)

**Relevance:** Every marketplace trade adds a provenance event to the credit's chain of custody.

### `automated-carbon-retirement` — Cluster B (MEDIUM)

**Relevance:** Buyers can immediately retire purchased credits. The marketplace integrates with the Retirement Engine.
