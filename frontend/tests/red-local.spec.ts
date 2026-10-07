import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Una dirección local en el código del navegador hace que Chrome y Edge pidan permiso de «red local» al visitante.
test('el código que llega al navegador no apunta al equipo ni a la red local', async () => {
  const dir = join(process.cwd(), 'dist-test', '_astro');
  const scripts = (await readdir(dir)).filter((f) => f.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    const code = await readFile(join(dir, file), 'utf8');
    expect(code, file).not.toMatch(/127\.0\.0\.1|\/\/localhost[:/]|192\.168\.\d/);
  }
});

test('la portada no hace peticiones al equipo ni a la red local', async ({ page, baseURL }) => {
  const locales: string[] = [];
  const sitio = new URL(baseURL!).origin;
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== sitio && /^(?:localhost|127\.|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|\[::1\])/.test(url.hostname)) locales.push(url.href);
  });
  await page.goto('/');
  await page.locator('[data-cifras]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  expect(locales).toEqual([]);
});
