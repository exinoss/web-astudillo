import { defineConfig } from '@playwright/test';
// Las pruebas compilan su propia copia con la semilla (`--mode test`) en `dist-test/` y la
// sirven en otro puerto: no dependen de la base ni pisan `dist/` ni el servidor de desarrollo.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4329';
export default defineConfig({
  testDir: './tests',
  // En CI Playwright usa por defecto la mitad de los núcleos; el runner de GitHub tiene 4.
  workers: process.env.CI ? 4 : undefined,
  // GitHub Actions (CI=true) no trae Edge: usa el Chromium de Playwright.
  use: { baseURL, channel: process.env.CI ? undefined : 'msedge', headless: true },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'bunx astro build --mode test --outDir dist-test && bunx astro preview --outDir dist-test --port 4329 --ignore-lock',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
