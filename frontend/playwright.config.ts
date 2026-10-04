import { defineConfig } from '@playwright/test';
// Las pruebas compilan su propia copia con la semilla (`--mode test`) en `dist-test/` y la
// sirven en otro puerto: no dependen de la base ni pisan `dist/` ni el servidor de desarrollo.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4329';
export default defineConfig({
  testDir: './tests',
  use: { baseURL, channel: 'msedge', headless: true },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'bunx astro build --mode test --outDir dist-test && bunx astro preview --outDir dist-test --port 4329 --ignore-lock',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
