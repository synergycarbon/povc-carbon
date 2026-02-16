# Marketplace & Portfolio UI Specification

> **Spec Collection:** marketplace-ui  
> **Implementation Phase:** Phase 8 (Weeks 45-52)  
> **Framework:** eStream Console Kit (`@estream/sdk-browser/widgets`)  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Sections 2.3–2.5, 9  
> **TakeTitle Reference:** [TakeTitle Architecture](../../../../TakeTitle/taketitle-io/docs/ARCHITECTURE.md)  
> **Console Reference:** [Console CLAUDE.md](../../../../polyquantum/estream-io/apps/console/CLAUDE.md)  
> **Branding Reference:** [Console branding.yaml](../../../../polyquantum/estream-io/apps/console/branding.yaml)  
> **Wire Protocol:** estream-io#551 — Spark auth over WebTransport datagrams (no HTTP fallback)

---

## 1. Overview

The SynergyCarbon marketplace UI is a **Console Kit deployment** (`@estream/sdk-browser/widgets`). It follows the same architectural pattern as TakeTitle: a standalone web app that registers product-specific widgets into the Console Kit widget system, using Spark wire protocol authentication (per estream-io#551), the WASM-backed WidgetDataGateway for secure lex topic access, and `--es-*` design tokens resolved from `branding.yaml`.

**Key Console Kit APIs:** `registerWidget()`, `useWidgetSubscription()`, `useWidgetData()`, `useEsliteQuery()`, `useTransportState()`, `useEStreamTheme()`, `useBranding()`, `WidgetFrame`, `WidgetGrid`, `WidgetPicker`.

### 1.1 The Shared Pattern

Both SynergyCarbon and TakeTitle follow the same user journey:

```
Marketing Site -> Marketplace (Browse/Buy) -> Portfolio (Own/Monitor) -> Actions (Retire/Distribute)
```

TakeTitle has:
- Marketplace.tsx (Offerings, Order Book, Commitments)
- Holdings.tsx (Portfolio Value, Total Invested, P&L, Holdings Table)
- AssetDetail.tsx (Provenance, metadata, history)

SynergyCarbon needs the same pattern for carbon credits:
- Browse credits by vintage, methodology, source type
- Purchase spot credits or propose forward contracts
- Track owned credits, retirement certificates, forward delivery progress
- Real-time yield forecasts, risk dashboards, impact visualization

---

## 2. Architecture

### 2.1 Application Structure

```
synergycarbon/
  povc-carbon/
    packages/
      web/                          # SynergyCarbon web app
        src/
          pages/
            Marketplace.tsx         # Credit marketplace (browse, buy)
            Portfolio.tsx           # Owned credits + forward contracts
            ForwardContracts.tsx    # Forward contract management
            Impact.tsx              # Impact dashboard + certificates
            Analytics.tsx           # AI forecasts, risk, accuracy
          widgets/                  # SynergyCarbon-specific widgets
            (registered into @estream/sdk-browser widget system)
          App.tsx                   # Routes, layout, Spark auth
        wrangler.toml               # Cloudflare Pages deployment
      marketing/                    # Marketing website (static)
        (Next.js/Astro SSG)
```

### 2.2 Widget System Extension

**New WidgetCategories** (extend `@estream/sdk-browser` types):
```
marketplace | portfolio | impact | trading
```

**New WidgetRoles** (extend `@estream/sdk-browser` types):
```
buyer | seller | auditor
```

These additions to the eStream SDK benefit both SynergyCarbon and TakeTitle.

---

## 3. Widget Catalog

### 3.1 Marketplace Category

| Widget ID | Title | Roles | Lex Topics | Description |
|-----------|-------|-------|------------|-------------|
| `credit-browser` | Credit Marketplace | buyer, seller | `sc.marketplace.listings.active` | Filterable credit catalog: vintage, methodology, source type, price. Card and list views. |
| `forward-curve` | Forward Price Curve | buyer, seller | `sc.ai.forecasts.price.forward_curve` | Interactive chart showing forward prices across 8 tenors with confidence bands. |
| `forward-proposal` | Forward Contract Proposal | buyer | `sc.forwards.propose`, `sc.forwards.counter` | Form to propose/negotiate forward contracts. Publishes typed ESF frames to lex topics. |
| `order-book` | Order Book | buyer, seller | `sc.marketplace.orders`, `sc.marketplace.market_data` | Coinbase-style buy/sell depth visualization. Green bids, red asks, depth bars. |

### 3.2 Portfolio Category

| Widget ID | Title | Roles | Lex Topics | Description |
|-----------|-------|-------|------------|-------------|
| `credit-portfolio` | Credit Portfolio | buyer, seller | `sc.credits.registry` | Owned credits with status, vintage, methodology, source. Sortable table with actions (sell, retire, transfer). |
| `portfolio-summary` | Portfolio Summary | buyer, seller | `sc.credits.registry`, `sc.forwards.contracts.active` | Total tCO2e owned, total value, unrealized P&L, active forwards count. |
| `retirement-certificates` | Retirement Certificates | buyer | `sc.retirements.certificates` | Gallery of retirement certificates with QR codes. Download/share actions. |
| `forward-contracts-portfolio` | Forward Contracts | buyer, seller | `sc.forwards.contracts.active`, `sc.forwards.settlements.completed` | Active contracts with delivery progress bars, settlement history, risk indicators. |

### 3.3 Impact Category

| Widget ID | Title | Roles | Lex Topics | Description |
|-----------|-------|-------|------------|-------------|
| `impact-counter` | Impact Counter | buyer (embeddable) | `sc.retirements.completed` | Running total of retired tCO2e with count-up animation. Embeddable via iframe/React/JS. |
| `impact-certificate` | Impact Certificate | buyer (embeddable) | `sc.retirements.certificates` | Visual retirement certificate display. Embeddable. |
| `impact-live-meter` | Live Generation Meter | buyer (embeddable) | `tz.teg.power` (or source-specific) | Real-time energy generation / emission avoidance. Embeddable. |

### 3.4 Observability Category (Carbon-Specific)

| Widget ID | Title | Roles | Lex Topics | Description |
|-----------|-------|-------|------------|-------------|
| `yield-forecast` | Yield Forecast | seller, auditor | `sc.ai.forecasts.yield.*` | 365-day yield projection with 80%/95% confidence bands. Per-project and fleet aggregate. |
| `risk-heatmap` | Risk Heatmap | seller, auditor | `sc.forwards.risk.delivery`, `sc.forwards.risk.portfolio` | Portfolio risk across tenors and counterparties. Color-coded risk scores. |
| `forecast-accuracy` | Forecast Accuracy | seller, auditor | `sc.ai.accuracy.*` | Historical forecast vs. actual minting overlay chart. MAE, MAPE, R² metrics. |
| `delivery-monitor` | Delivery Monitor | buyer, seller | `sc.forwards.settlements.completed`, `sc.forwards.contracts.active` | Real-time delivered vs. committed gauge per contract. |
| `basis-chart` | Basis Spread | buyer, seller | `sc.forwards.market.basis` | Forward vs. spot price spread time series. |

---

## 4. Data Access Pattern

All widgets follow the eStream console widget data access pattern:

```
Widget -> useWidgetData() -> gateway_authorize (WASM) -> EstreamClient (WebTransport) -> Edge
```

Rules:
1. Use `useWidgetData()` or `useWidgetSubscription()` for all lex topic access
2. Declare all topics in `lexStreams` at widget registration
3. Never import `EstreamClient` directly
4. Never use `fetch()`, `EventSource`, or `WebTransport` directly
5. RBAC is enforced in Rust/WASM — TypeScript is visual only

---

## 5. Authentication

Spark visual authentication (same flow as eStream console):
1. User clicks "Start Spark Login"
2. SDK creates challenge via edge API
3. Browser renders animated Spark with lookup code
4. User scans with eStream Wallet app
5. Mobile signs challenge with ML-DSA-87
6. Browser receives session and redirects

Roles assigned via governance circuit based on wallet identity:
- **buyer** — Can browse marketplace, purchase credits, manage portfolio, retire credits
- **seller** — Can list credits, manage listings, propose/negotiate forward contracts
- **auditor** — Compliance access to verification data and audit trails

---

## 6. Design System

Uses `--es-*` design tokens from `@estream/sdk-browser` with SynergyCarbon branding overlay:

- Brand colors: green-tinted accent (carbon/sustainability theme)
- Same dark/light mode support as eStream console
- Same card, table, stats-grid, badge components
- Same responsive/accessible standards (WCAG 2.1 AA)

Configured via `branding.yaml` (same pattern as eStream console's `apps/console/branding.yaml`).

---

## 7. Marketing Website

### 7.1 Architecture

Static site (Next.js SSG or Astro) deployed to Cloudflare Pages at `synergycarbon.io`:

- **Pages:** Home, How It Works, For Buyers, For Generators, Technology, About, Contact
- **Embedded widgets:** Impact counter and live meter via iframe from widget system
- **CTA:** Links to authenticated marketplace app (Spark login)
- **No authentication required** — fully public
- **Design tokens:** Shared `--es-*` tokens with SynergyCarbon branding

### 7.2 Content Strategy

| Page | Purpose | Key Content |
|------|---------|-------------|
| Home | Value proposition | Hero, live impact counter, key metrics, CTAs |
| How It Works | Technical credibility | PoVC verification flow, hardware attestation, comparison vs. traditional |
| For Buyers | Buyer acquisition | Marketplace preview, forward contracts, retirement workflow |
| For Generators | Seller/tenant onboarding | Universal witness node, methodology support, revenue model |
| Technology | Deep dive | eStream platform, SmartCircuits, PQ crypto, AI forecasting |
| About | Trust building | Team, patents, compliance standards |

---

## 8. Shared Widget Patterns (estream-io Upstream)

These generic patterns benefit both SynergyCarbon and TakeTitle and could become a shared `@estream/marketplace-widgets` package or new categories in `@estream/sdk-browser`:

| Pattern | SynergyCarbon Usage | TakeTitle Usage |
|---------|-------------------|-----------------|
| **Asset Browser** | Credit marketplace with filters | Title/offering catalog |
| **Portfolio Summary** | tCO2e owned, value, P&L | Portfolio value, invested, P&L |
| **Holdings Table** | Credits with status, actions | Tokens with cost basis, actions |
| **Order Book** | Spot credit buy/sell depth | DEED token order book |
| **Provenance Timeline** | Credit chain of custody | Title ownership chain |
| **Settlement History** | Forward contract deliveries | Trade execution history |

---

## 9. Exit Criteria

- Web app deployed to Cloudflare Pages with Spark authentication
- All 16 widgets registered and functional
- WidgetDataGateway RBAC enforcing buyer/seller/auditor roles
- Real-time data via lex topic subscriptions (< 1s latency)
- Impact widgets embeddable via iframe, React, and vanilla JS
- Marketing site deployed at synergycarbon.io
- WCAG 2.1 AA compliant
