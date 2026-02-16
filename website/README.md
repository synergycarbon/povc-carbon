# SynergyCarbon Marketing Website

Static marketing site for SynergyCarbon built with Astro.

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
│   ├── pages/
│   │   └── index.astro      # Landing page
│   └── layouts/
│       └── Base.astro        # Shared layout
├── public/
│   └── brand/                # Logo assets
├── astro.config.mjs
└── package.json
```

## Deployment

Static output to `dist/`. Deploy to any static hosting (Cloudflare Pages, Vercel, Netlify).
