import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321';
export default defineConfig({
  testDir: './tests',
  use: { baseURL, channel: 'msedge', headless: true },
  webServer: { command: 'bun run preview -- --port 4321 --ignore-lock', url: baseURL, reuseExistingServer: true, env: { ASTRO_TELEMETRY_DISABLED: '1' } },
});
