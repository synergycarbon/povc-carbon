import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://synergycarbon.com',
  output: 'static',
  build: {
    assets: 'assets',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_CONSOLE_ORIGIN': JSON.stringify(
        process.env.PUBLIC_CONSOLE_ORIGIN ?? 'https://console.synergycarbon.io'
      ),
    },
  },
});
