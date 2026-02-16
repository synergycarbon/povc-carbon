# SynergyCarbon Console

Console Kit deployment for the SynergyCarbon PoVC-Carbon platform.

## Architecture

This is an **eStream Console Kit** application (`@estream/sdk-browser/widgets`). It provides a widget-based dashboard for carbon credit management, marketplace, compliance, and impact visualization.

### Stack

- **Framework:** Console Kit (`@estream/sdk-browser/widgets`)
- **Transport:** WebTransport datagrams (HTTP/3) — no HTTP REST fallback
- **Auth:** Spark wire protocol (ML-DSA-87 post-quantum)
- **Storage:** ESLite (WASM local-first cache)
- **RBAC:** WASM-backed data gateway with visibility tier enforcement
- **Branding:** `branding.yaml` → `--es-*` CSS custom properties

### Widget Catalog (14 widgets)

| Category | Widget | Role |
|----------|--------|------|
| Impact | Impact Counter | public |
| Impact | Impact Certificate | buyer |
| Impact | Impact Live Meter | public |
| Impact | Impact Leaderboard | public |
| Operations | Credit Registry | buyer |
| Operations | Attestation Monitor | auditor |
| Operations | Marketplace | buyer |
| Operations | Retirement Engine | owner |
| Operations | Audit Trail | auditor |
| Operations | Governance | owner |
| Analytics | Yield Forecast | buyer |
| Analytics | Forward Contracts | buyer |
| Analytics | Risk Monitor | buyer |
| Analytics | Pricing Oracle | buyer |

## Development

```bash
npm install
npm run dev       # http://localhost:3100
npm run build     # Production build
npm run typecheck # TypeScript validation
```

## Configuration

Set the eStream endpoint via environment variable:

```bash
VITE_ESTREAM_ENDPOINT=https://edge.estream.io npm run dev
```

## References

- [DESIGN.md](../docs/DESIGN.md) — Sections 2.3–2.5 (Console Kit Foundation)
- [branding.yaml](./branding.yaml) — Theme configuration
- [Console Kit docs](../../polyquantum/estream-io/apps/console/CLAUDE.md)
