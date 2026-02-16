import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://synergycarbon.io',
  output: 'static',
  build: {
    assets: 'assets',
  },
});
