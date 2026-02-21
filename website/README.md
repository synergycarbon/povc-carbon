# SynergyCarbon Marketing Website

Static marketing site for SynergyCarbon built with Astro 5.x, deployed to Cloudflare Pages.

## Development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## Structure

```
website/
├── src/
│   ├── components/
│   │   └── ImpactWidget.astro  # Standalone impact widget embed
│   ├── pages/
│   │   ├── index.astro         # Homepage
│   │   ├── how-it-works.astro  # PoVC process walkthrough
│   │   ├── for-buyers.astro    # Buyer-focused landing page
│   │   ├── for-developers.astro
│   │   ├── technology.astro
│   │   ├── marketplace.astro
│   │   ├── api.astro
│   │   └── about.astro
│   ├── layouts/
│   │   └── Base.astro          # Shared layout (nav, footer, scripts)
│   └── styles/
│       └── global.css
├── public/
│   └── brand/                  # Logo/icon assets
├── astro.config.mjs
└── package.json
```

## Deployment (Cloudflare Pages)

The site deploys automatically via GitHub Actions (`.github/workflows/deploy-website.yml`).

| Trigger | Environment |
|---------|-------------|
| Push to `main` (paths: `website/**`) | **Production** — `synergycarbon.com` |
| Pull request to `main` | **Preview** — `<branch>.synergycarbon-website.pages.dev` |

### Required Secrets

Set these in the GitHub repo settings under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_API_TOKEN` | Cloudflare API token with Pages edit permissions |

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_CONSOLE_ORIGIN` | Console base URL for widget embeds | `https://console.synergycarbon.io` |

### Custom Domain Setup

1. In the Cloudflare dashboard, go to **Pages → synergycarbon-website → Custom domains**
2. Add `synergycarbon.com` and `www.synergycarbon.com`
3. Cloudflare will auto-provision SSL and configure DNS if the domain is on Cloudflare DNS

## Impact Widget Embedding

The `ImpactWidget.astro` component embeds the SynergyCarbon impact-counter widget
in standalone mode using the eStream WASM/Wire embedding pattern (eStream #146).

### Usage

```astro
---
import ImpactWidget from '../components/ImpactWidget.astro';
---

<!-- Default: impact counter, auto theme -->
<ImpactWidget />

<!-- With project/entity filter -->
<ImpactWidget projectId="entity_abc123" />

<!-- Different widget modes -->
<ImpactWidget mode="counter" />
<ImpactWidget mode="certificate" />
<ImpactWidget mode="meter" />

<!-- Explicit theme -->
<ImpactWidget theme="dark" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | — | Entity/project ID to filter metrics |
| `mode` | `'counter' \| 'certificate' \| 'meter'` | `'counter'` | Widget display mode |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color scheme |

### Pages with Widget

- **Homepage** (`/`) — "Live Carbon Impact" section
- **How It Works** (`/how-it-works`) — "See It In Action" section
- **For Buyers** (`/for-buyers`) — Retirement & ESG section
