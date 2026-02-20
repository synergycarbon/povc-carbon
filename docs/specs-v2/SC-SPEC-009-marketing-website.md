# SC-SPEC-009: Marketing Website

> **Status**: Draft
> **Scope**: Astro SSG static site, Cloudflare Pages deployment, carbon credit marketplace promotion
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)

---

## 1. Overview

The SynergyCarbon marketing website is a static site built with **Astro 5.x + React islands**, deployed to **Cloudflare Pages**. It communicates the value proposition of hardware-verified carbon credits, drives project developer and buyer onboarding, and hosts embeddable impact widgets that demonstrate live platform activity.

**Domain:** `synergycarbon.com`
**Location:** `povc-carbon/website/` (already scaffolded with Astro 5.3)
**Deployment:** Cloudflare Pages (automatic from `main` branch)

---

## 2. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Astro 5.3 | Static Site Generation (SSG) |
| Islands | React 19 | Interactive components hydrated on demand |
| Styling | Tailwind CSS 4.x | Extends console design tokens |
| Build | Vite (via Astro) | Sub-second HMR |
| Deployment | Cloudflare Pages | Edge-cached, global CDN |
| Analytics | StreamSight (self-hosted) | Privacy-first, no third-party trackers |
| Forms | Cloudflare Workers (contact/waitlist) | Serverless form handlers |

---

## 3. Page Structure

### 3.1 Hero / Landing

**Route:** `/`

- Headline: "Carbon Credits You Can Verify" (or equivalent value prop)
- Subhead: Hardware-attested, post-quantum secured, real-time verified
- Animated impact counter (embedded `impact-counter` widget in standalone mode)
- Primary CTA: "Browse Marketplace" → `/marketplace-preview`
- Secondary CTA: "For Project Developers" → `/developers`
- ThermogenZero case study hero image (thermoelectric microgrid at wellpad)

### 3.2 How It Works

**Route:** `/how-it-works`

Visual step-by-step of the PoVC attestation flow:

1. **Sensor** — Hardware witnesses capture real-time energy generation data
2. **Attest** — Witness quorum signs Merkle root with ML-DSA-87
3. **Verify** — PoVCR SmartCircuit validates attestation against methodology
4. **Mint** — Verified emissions reduction becomes a tradable credit NFT
5. **Trade** — Credits listed on marketplace or committed via forward contracts
6. **Retire** — Buyer retires credit; immutable certificate generated

Each step includes an illustration, brief description, and link to technical documentation.

### 3.3 For Project Developers

**Route:** `/developers`

- Onboarding process overview (apply → integrate → attest → earn)
- Supported methodologies table:
  - EPA AP-42 CH4 Flare (ThermogenZero)
  - Verra VCS (planned)
  - Gold Standard (planned)
  - ISCC (planned)
- Revenue projection calculator (React island): input capacity, utilization, methodology → estimated annual credits and revenue
- Hardware integration requirements (supported sensor types, witness node specs)
- API documentation link → B2B API docs
- CTA: "Apply to List Your Project"

### 3.4 For Buyers

**Route:** `/buyers`

- Browse marketplace value prop (transparent pricing, verified provenance)
- Retirement certificate example (embedded `impact-certificate` widget)
- ESG reporting integration (GHG Protocol, CDP, TCFD alignment)
- Forward contract overview (lock in future supply at predictable pricing)
- Bulk purchase / enterprise inquiry form
- CTA: "Start Buying Credits"

### 3.5 Marketplace Preview

**Route:** `/marketplace-preview`

- Public view of credit availability (read-only, no authentication required)
- Embedded `impact-live-meter` widget showing real-time generation rate
- Aggregate statistics: total credits issued, retired, available
- Methodology breakdown chart (React island)
- Vintage distribution chart (React island)
- CTA: "Sign Up to Trade" → Console onboarding

### 3.6 Technology

**Route:** `/technology`

- eStream platform overview (post-quantum cryptographic infrastructure)
- Post-quantum security: ML-DSA-87 signatures, ML-KEM-1024 key exchange
- Proof of Verified Carbon (PoVC) — the attestation protocol
- SmartCircuit architecture — deterministic, auditable compute
- Scatter-CAS storage — distributed, content-addressed, erasure-coded
- Comparison table: SynergyCarbon vs. traditional registries

| Feature | Traditional Registry | SynergyCarbon |
|---------|---------------------|---------------|
| Verification | Periodic audit | Continuous hardware attestation |
| Provenance | Self-reported | Merkle-rooted sensor data |
| Cryptography | RSA/ECDSA | ML-DSA-87 (post-quantum) |
| Settlement | Manual | SmartCircuit automated |
| Transparency | Opaque | On-chain audit trail |

### 3.7 About / Partners

**Route:** `/about`

- Company overview (SynergyCarbon — a PolyQuantum Labs venture)
- Team section
- Partner logos (ThermogenZero as launch partner)
- Contact information
- Press kit / media resources

### 3.8 API Documentation

**Route:** `/api` (redirect)

- Redirects to `https://api.synergycarbon.com/docs` (interactive OpenAPI docs)
- Brief overview of B2B integration capabilities on the marketing site
- Code samples for common operations (issue, retire, query)

---

## 4. Embeddable Impact Widget Integration

### 4.1 Homepage Integration

The hero section embeds the `impact-counter` widget in standalone mode:

```astro
---
// Hero.astro
---
<section class="hero">
  <h1>Carbon Credits You Can Verify</h1>
  <div class="impact-embed">
    <iframe
      src="https://console.synergycarbon.com/embed/impact-counter?tenant=platform&theme=dark"
      width="400"
      height="200"
      loading="lazy"
    ></iframe>
  </div>
</section>
```

### 4.2 Marketplace Preview Integration

The marketplace preview page embeds the `impact-live-meter`:

```astro
---
// MarketplacePreview.astro
---
<div class="live-meter">
  <iframe
    src="https://console.synergycarbon.com/embed/impact-live-meter?tenant=platform"
    width="320"
    height="180"
    loading="lazy"
  ></iframe>
</div>
```

---

## 5. Design System

### 5.1 Brand Extension

The marketing site extends the Console `branding.yaml` design tokens:

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#16a34a` | CTAs, links, accents |
| Primary light | `#22c55e` | Hover states, gradients |
| Primary dark | `#15803d` | Active states |
| Background | `#0a0a0a` | Dark sections |
| Surface | `#171717` | Cards, feature blocks |
| Text primary | `#fafafa` | Headings on dark |
| Text secondary | `#a3a3a3` | Body text on dark |

### 5.2 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 | Inter | 800 | 4rem |
| H2 | Inter | 700 | 2.5rem |
| H3 | Inter | 600 | 1.5rem |
| Body | Inter | 400 | 1.125rem |
| Code | JetBrains Mono | 400 | 0.875rem |

### 5.3 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, stacked sections |
| Tablet | 640–1024px | Two-column where appropriate |
| Desktop | 1024–1440px | Full layout, side-by-side features |
| Wide | > 1440px | Max-width container, centered |

---

## 6. Performance & SEO

### 6.1 Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 95 |
| First Contentful Paint | < 1.0s |
| Largest Contentful Paint | < 2.0s |
| Total Blocking Time | < 100ms |
| Cumulative Layout Shift | < 0.05 |
| Bundle size (initial) | < 100 KB (gzipped) |

### 6.2 SEO

- Astro SSG generates fully static HTML (zero client JS by default)
- React islands hydrate only interactive components (calculator, charts)
- `<meta>` tags, Open Graph, and structured data (JSON-LD) for all pages
- Sitemap generated at build time (`sitemap.xml`)
- Canonical URLs on all pages
- Image optimization via Astro `<Image>` component (WebP/AVIF)

### 6.3 Cloudflare Pages Configuration

```toml
# wrangler.toml
name = "synergycarbon-website"
compatibility_date = "2026-02-01"

[site]
bucket = "./dist"

[[redirects]]
from = "/api"
to = "https://api.synergycarbon.com/docs"
status = 301

[[headers]]
for = "/embed/*"
  [headers.values]
  X-Frame-Options = "ALLOWALL"
  Content-Security-Policy = "frame-ancestors *"

[[headers]]
for = "/*"
  [headers.values]
  X-Content-Type-Options = "nosniff"
  X-Frame-Options = "DENY"
  Referrer-Policy = "strict-origin-when-cross-origin"
  Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

---

## 7. Directory Structure

```
povc-carbon/
  website/                          # Astro 5.3 project root
    src/
      pages/
        index.astro                 # Hero / Landing
        how-it-works.astro          # PoVC attestation flow
        developers.astro            # For Project Developers
        buyers.astro                # For Buyers
        marketplace-preview.astro   # Public marketplace view
        technology.astro            # eStream platform / security
        about.astro                 # About / Partners
      components/
        Hero.astro                  # Landing hero with impact counter
        StepFlow.astro              # How-it-works step visualization
        MethodologyTable.astro      # Supported methodologies
        ComparisonTable.astro       # SynergyCarbon vs. traditional
        RevenueCalculator.tsx       # React island: revenue projection
        MarketCharts.tsx            # React island: methodology/vintage charts
        ContactForm.tsx             # React island: waitlist/contact form
        Footer.astro                # Site-wide footer
        Nav.astro                   # Site-wide navigation
      layouts/
        Base.astro                  # HTML shell, meta, fonts
        Page.astro                  # Standard page layout
      styles/
        global.css                  # Tailwind imports, design tokens
    public/
      images/                       # Optimized static images
      fonts/                        # Inter, JetBrains Mono (self-hosted)
      favicon.svg
    astro.config.mjs
    tailwind.config.ts
    wrangler.toml
    package.json
```

---

## 8. Content Management

### 8.1 Static Content

All page content is authored directly in `.astro` files. No external CMS — content changes are committed to the repo and deployed via CI/CD.

### 8.2 Dynamic Data

Live data on the marketplace preview page comes exclusively from embedded Console widgets (iframes). The marketing site itself makes no API calls.

### 8.3 Blog / Updates

Future consideration. If added, will use Astro Content Collections with MDX for rich posts, deployed as additional static pages.

---

## 9. Launch Checklist

| Item | Status |
|------|--------|
| Domain `synergycarbon.com` configured | Pending |
| Cloudflare Pages project created | Pending |
| SSL certificate provisioned | Auto (Cloudflare) |
| StreamSight analytics snippet deployed | Pending |
| Impact widget embed URLs configured | Pending |
| Open Graph images generated | Pending |
| Sitemap + robots.txt verified | Pending |
| Lighthouse audit passing (> 95) | Pending |
| Legal pages (Privacy, Terms) added | Pending |
| ThermogenZero case study approved | Pending |
