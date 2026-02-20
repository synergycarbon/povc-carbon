# SC-SPEC-007: Console

> **Status**: Draft
> **Scope**: 14 Console Kit widgets, RBAC (4 visibility tiers), demo mode with ESZ fixtures, Console Kit architecture
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)

---

## 1. Overview

The SynergyCarbon Console is a **Console Kit deployment** (`@synergycarbon/console`) built with React 19 + Vite. It registers 14 product-specific widgets into the eStream Console Kit widget system, providing a unified dashboard for credit management, marketplace operations, audit, governance, AI analytics, and public impact tracking.

The Console follows the established Console Kit pattern: Spark wire protocol authentication over WebTransport, WASM-backed `WidgetDataGateway` for secure lex topic access, ESLite local-first storage for offline capability, and `--es-*` design tokens resolved from `branding.yaml`.

**Package:** `@synergycarbon/console`
**Framework:** React 19 + Vite
**Console Kit APIs:** `registerWidget()`, `useWidgetSubscription()`, `useWidgetData()`, `useEsliteQuery()`, `useTransportState()`, `useEStreamTheme()`, `useBranding()`, `WidgetFrame`, `WidgetGrid`, `WidgetPicker`

---

## 2. Widget Inventory

### 2.1 All 14 Widgets

| # | Widget ID | Name | Visibility Tier | Category |
|---|-----------|------|-----------------|----------|
| 1 | `credit-registry` | Credit Registry | owner | Core |
| 2 | `marketplace` | Marketplace | buyer | Core |
| 3 | `retirement-engine` | Retirement Engine | buyer | Core |
| 4 | `audit-trail` | Audit Trail | auditor | Compliance |
| 5 | `governance` | Governance | auditor | Compliance |
| 6 | `attestation-monitor` | Attestation Monitor | auditor | Compliance |
| 7 | `forward-contracts` | Forward Contracts | buyer | Trading |
| 8 | `yield-forecast` | Yield Forecast | owner | Analytics |
| 9 | `risk-monitor` | Risk Monitor | owner | Analytics |
| 10 | `pricing-oracle` | Pricing Oracle | owner | Analytics |
| 11 | `impact-counter` | Impact Counter | public | Impact |
| 12 | `impact-certificate` | Impact Certificate | buyer | Impact |
| 13 | `impact-live-meter` | Impact Live Meter | public | Impact |
| 14 | `impact-leaderboard` | Impact Leaderboard | public | Impact |

### 2.2 Widget Manifest Pattern

Each widget follows the same file structure:

```
widgets/
  credit-registry/
    manifest.ts          # Metadata, RBAC, data subscriptions
    CreditRegistry.tsx   # React component
    index.ts             # Re-export
  marketplace/
    manifest.ts
    Marketplace.tsx
    index.ts
  ...
```

**manifest.ts structure:**

```typescript
export const manifest: WidgetManifest = {
  id: 'credit-registry',
  name: 'Credit Registry',
  category: 'core',
  icon: 'registry',
  minTier: 'owner',
  defaultSize: { w: 4, h: 3 },
  subscriptions: [
    'sc.credits.*',
    'sc.attestations.verified',
  ],
  esliteTables: ['credits', 'attestations'],
  refreshInterval: 5_000,
};
```

---

## 3. RBAC — 4 Visibility Tiers

### 3.1 Tier Definitions

| Tier | Audience | Description |
|------|----------|-------------|
| **public** | Anyone | Unauthenticated; embeddable on external sites |
| **buyer** | Registered credit buyers | Spark-authenticated; marketplace and retirement access |
| **auditor** | Third-party verifiers | Spark-authenticated + auditor role; compliance and attestation access |
| **owner** | Credit originators / platform admins | Spark-authenticated + owner role; full platform access |

### 3.2 Widget Access Matrix

| Widget | public | buyer | auditor | owner |
|--------|--------|-------|---------|-------|
| impact-counter | R | R | R | R |
| impact-leaderboard | R | R | R | R |
| impact-live-meter | R | R | R | R |
| marketplace | — | R | R | R |
| forward-contracts | — | R/W | R | R/W |
| retirement-engine | — | R/W | R | R/W |
| impact-certificate | — | R | R | R |
| audit-trail | — | — | R | R |
| attestation-monitor | — | — | R | R |
| governance | — | — | R/W | R/W |
| credit-registry | — | — | — | R/W |
| yield-forecast | — | — | — | R |
| risk-monitor | — | — | — | R |
| pricing-oracle | — | — | — | R |

R = read, R/W = read + write actions, — = not visible

### 3.3 RBAC Enforcement

Authorization is enforced at two layers:

1. **WidgetPicker** — Only shows widgets the current Spark identity has access to
2. **WidgetDataGateway** — WASM `gateway_authorize()` call validates tier before lex topic subscription

Tier is derived from the Spark identity's RBAC profile in the `sc.rbac` lex namespace.

---

## 4. Data Gateway & ESLite

### 4.1 WASM-Backed Authorization

```
Spark Identity → WidgetDataGateway (WASM)
  → gateway_authorize(spark_id, widget_id, subscription)
    → rbac_verify(spark_id, required_tier)
      → if authorized: subscribe to lex topic
      → if denied: WidgetFrame shows "Upgrade access" prompt
```

### 4.2 ESLite Local-First Storage

11 ESLite table schemas for offline-first operation:

| # | Table | Primary Key | Sync Topic | Description |
|---|-------|-------------|------------|-------------|
| 1 | `credits` | `credit_id` | `sc.credits.*` | Credit registry cache |
| 2 | `attestations` | `attestation_id` | `sc.attestations.*` | Attestation records |
| 3 | `retirements` | `retirement_id` | `sc.retirements.*` | Retirement certificates |
| 4 | `orders` | `order_id` | `sc.marketplace.orders` | Active marketplace orders |
| 5 | `contracts` | `contract_id` | `sc.forwards.contracts.*` | Forward contracts |
| 6 | `audit_events` | `event_id` | `sc.audit.*` | Audit trail entries |
| 7 | `methodologies` | `methodology_id` | `sc.governance.methodologies` | Approved methodologies |
| 8 | `yield_forecasts` | `forecast_id` | `sc.ai.forecasts.yield.*` | Cached yield predictions |
| 9 | `price_curves` | `curve_id` | `sc.ai.pricing.*` | Forward price curves |
| 10 | `risk_metrics` | `metric_id` | `sc.ai.risk.*` | Risk assessment snapshots |
| 11 | `impact_stats` | `tenant_id` | `sc.impact.*` | Aggregated impact counters |

All tables use CRDT merge for conflict resolution during offline sync.

---

## 5. Widget Details

### 5.1 Core Widgets

**credit-registry** (owner) — Full credit lifecycle management. View all issued credits, filter by vintage/methodology/status. Actions: issue, transfer, cancel. Subscribes to `sc.credits.*`.

**marketplace** (buyer) — Browse available credits, view order book, place spot buy/sell orders. Real-time price ticker from `sc.marketplace.market_data`. Filter by methodology, vintage, source type.

**retirement-engine** (buyer) — Initiate credit retirement, specify beneficiary and purpose. Generates retirement certificate with ML-DSA-87 signature. Subscribes to `sc.retirements.*`.

### 5.2 Compliance Widgets

**audit-trail** (auditor) — Chronological log of all platform events: issuance, transfer, retirement, governance actions. Filterable by event type, tenant, date range. Immutable append-only view.

**governance** (auditor) — Methodology management, proposal creation and voting, compliance flag review. Actions: propose methodology change, vote, approve/reject.

**attestation-monitor** (auditor) — Real-time view of PoVCR attestation flow. Displays witness quorum status, Merkle root verification, attestation success rate. Alerts on failed attestations.

### 5.3 Trading Widgets

**forward-contracts** (buyer) — View active forward contracts, delivery progress, settlement status. Actions: propose new contract, accept/reject terms, mark delivered. Integrates yield forecast for commitment sizing.

### 5.4 Analytics Widgets

**yield-forecast** (owner) — Multi-horizon yield prediction chart (24h through 1y). Displays point estimate with 80%/95% confidence bands. Model version and accuracy metrics. Source: `sc.ai.forecasts.yield.*`.

**risk-monitor** (owner) — Four-quadrant risk dashboard: counterparty, delivery, market, methodology. Each dimension shows score (0–100), trend arrow, and contributing indicators. Alerts panel for threshold breaches.

**pricing-oracle** (owner) — Forward price curve visualization across tenors. Spot price ticker, vintage pricing, methodology premium breakdown. Source: `sc.ai.pricing.*`.

### 5.5 Impact Widgets

**impact-counter** (public) — Cumulative tCO2e retired counter with animated increment. Configurable display: total platform, per-tenant, or per-project. Embeddable.

**impact-certificate** (buyer) — Generates and displays retirement certificates. Includes QR code linking to on-chain verification, ML-DSA-87 signature, beneficiary details.

**impact-live-meter** (public) — Real-time carbon credit generation rate. Animated gauge showing current yield rate (tCO2e/hour). Embeddable.

**impact-leaderboard** (public) — Ranked list of top credit retirees by volume. Opt-in display — participants must enable public visibility. Embeddable.

---

## 6. Demo Mode

### 6.1 DemoProvider

The `DemoProvider` component enables offline demonstration of the full Console without a live eStream connection.

```typescript
<DemoProvider fixture="esz-thermogenzero-demo">
  <Console />
</DemoProvider>
```

### 6.2 ESZ Fixture Data

Demo mode loads ESZ (eStream Zip) fixture archives into ESLite:

| Fixture | Contents | Records |
|---------|----------|---------|
| `credits.esz` | 250 sample credits across 3 vintages | 250 |
| `attestations.esz` | Matching attestations with Merkle roots | 250 |
| `retirements.esz` | 50 completed retirements with certificates | 50 |
| `orders.esz` | 100 historical + 20 active marketplace orders | 120 |
| `contracts.esz` | 10 forward contracts in various states | 10 |
| `forecasts.esz` | 30 days of hourly yield forecasts | 720 |
| `price_curves.esz` | Forward curves for 5 tenors | 30 |
| `risk_metrics.esz` | 30 days of hourly risk snapshots | 720 |
| `impact.esz` | Aggregated impact statistics | 5 |

### 6.3 Demo Behavior

- All lex topic subscriptions are intercepted and served from ESLite
- Transport state shows `demo` instead of `connected`
- Write actions (retire, order, propose) are simulated locally
- Demo badge displayed in WidgetFrame header
- No network requests; fully offline

---

## 7. Branding

### 7.1 Design Tokens

Resolved from `branding.yaml`:

| Token | Value | Usage |
|-------|-------|-------|
| `--es-color-primary` | `#16a34a` | Primary green |
| `--es-color-primary-light` | `#22c55e` | Hover states |
| `--es-color-primary-dark` | `#15803d` | Active states |
| `--es-spark-hue` | `145` | Spark identity ring color |
| `--es-color-background` | `#0a0a0a` (dark) / `#fafafa` (light) | Base background |
| `--es-color-surface` | `#171717` (dark) / `#ffffff` (light) | Card/widget surfaces |
| `--es-font-family` | `Inter, system-ui, sans-serif` | Body text |
| `--es-font-mono` | `JetBrains Mono, monospace` | Code, IDs, hashes |

### 7.2 Dark Mode

Dark mode is the default. Light mode is available via `useEStreamTheme()` toggle. All widgets must support both modes using `--es-*` CSS custom properties.

### 7.3 Green Palette

```
50:  #f0fdf4    100: #dcfce7    200: #bbf7d0
300: #86efac    400: #4ade80    500: #22c55e
600: #16a34a    700: #15803d    800: #166534
900: #14532d    950: #052e16
```

---

## 8. Embeddable Widgets

### 8.1 Standalone Mount

Three widgets support embedding on external corporate websites:

| Widget | Route | Use Case |
|--------|-------|----------|
| `impact-counter` | `/embed/impact-counter` | Corporate sustainability page |
| `impact-certificate` | `/embed/impact-certificate/{id}` | Retirement proof display |
| `impact-live-meter` | `/embed/impact-live-meter` | Real-time carbon offset tracking |

### 8.2 Integration

```html
<iframe
  src="https://console.synergycarbon.com/embed/impact-counter?tenant=thermogenzero"
  width="320"
  height="180"
  frameborder="0"
  allow="clipboard-write"
></iframe>
```

Alternatively, via JavaScript mount:

```html
<script src="https://console.synergycarbon.com/embed/sdk.js"></script>
<div id="sc-impact"></div>
<script>
  SynergyCarbon.mount('impact-counter', {
    el: '#sc-impact',
    tenant: 'thermogenzero',
    theme: 'dark',
  });
</script>
```

### 8.3 Embed Security

- Public widgets require no authentication
- Buyer-tier embeds require a signed embed token (ML-DSA-87)
- CSP headers: `frame-ancestors` whitelist configured per tenant
- No cookie access; all state via postMessage API

---

## 9. Application Structure

```
povc-carbon/
  packages/
    console/
      src/
        widgets/
          credit-registry/     manifest.ts + CreditRegistry.tsx
          marketplace/         manifest.ts + Marketplace.tsx
          retirement-engine/   manifest.ts + RetirementEngine.tsx
          audit-trail/         manifest.ts + AuditTrail.tsx
          governance/          manifest.ts + Governance.tsx
          attestation-monitor/ manifest.ts + AttestationMonitor.tsx
          forward-contracts/   manifest.ts + ForwardContracts.tsx
          yield-forecast/      manifest.ts + YieldForecast.tsx
          risk-monitor/        manifest.ts + RiskMonitor.tsx
          pricing-oracle/      manifest.ts + PricingOracle.tsx
          impact-counter/      manifest.ts + ImpactCounter.tsx
          impact-certificate/  manifest.ts + ImpactCertificate.tsx
          impact-live-meter/   manifest.ts + ImpactLiveMeter.tsx
          impact-leaderboard/  manifest.ts + ImpactLeaderboard.tsx
        pages/
          Marketplace.tsx
          Portfolio.tsx
          ForwardContracts.tsx
          Impact.tsx
          Analytics.tsx
          Admin.tsx
        embed/
          ImpactCounterEmbed.tsx
          ImpactCertificateEmbed.tsx
          ImpactLiveMeterEmbed.tsx
          sdk.ts
        demo/
          DemoProvider.tsx
          fixtures/             ESZ fixture files
        App.tsx
        main.tsx
      branding.yaml
      vite.config.ts
      wrangler.toml
```
