import { test, expect } from '@playwright/test';

test('desktop navigation, carousel and accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Acerca de nosotros' })).toBeVisible();
  await page.getByRole('button', { name: 'Propuestas', exact: true }).hover();
  await expect(page.locator('#proposals-menu')).toBeVisible();
  await page.locator('#proposals-menu a').first().hover();
  await expect(page.locator('#proposals-menu')).toBeVisible();
  await page.locator('#proposals-menu a').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#proposals-menu')).toBeHidden();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#proposals-menu a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ver diapositiva 2' }).click();
  await expect(page.locator('[data-slide="1"]')).toBeVisible();
  await page.getByRole('button', { name: 'Ver diapositiva 1' }).click();
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).click();
  await page.getByRole('button', { name: 'Aumentar texto' }).click();
  await expect(page.locator('html')).toHaveClass(/text-large/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/text-large/);
  expect(errors).toEqual([]);
});

test('mobile navigation in three taps and responsive layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Propuestas', exact: true }).click();
  await expect(page.locator('#proposals-menu')).toBeVisible();
  await page.locator('#proposals-menu').getByRole('link', { name: 'Agua potable' }).click();
  await expect(page).toHaveURL(/propuestas\/agua-potable/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agua potable');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('all internal destinations and image resources exist', async ({ page, request }) => {
  await page.goto('/');
  const links = await page.locator('a[href^="/"]').evaluateAll(nodes => [...new Set(nodes.map(n => n.getAttribute('href')!.split('#')[0]).filter(Boolean))]);
  for (const href of links) expect((await request.get(href)).ok(), href).toBeTruthy();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#contacto').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(img => img.getClientRects().length > 0).every(img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0))).toBeTruthy();
  }
});

test('automatic carousel advances and respects the reduced-motion accessibility setting', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.fastForward(6500);
  await expect(page.locator('[data-slide="1"]')).toBeVisible();
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).click();
  await page.getByRole('button', { name: 'Reducir movimiento' }).click();
  await expect(page.getByRole('button', { name: 'Reducir movimiento' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ver diapositiva 1' }).click();
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
  await page.clock.fastForward(13000);
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
});

test('reporting is reachable from the Ciudadanía menu on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.proposal-card').first()).toHaveCSS('background-color', 'rgb(254, 255, 255)');
  await expect(page.locator('a[href="https://www.facebook.com/carlosastudillo7"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.tiktok.com/@carlosastudillo01"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Ciudadanía' }).click();
  await page.locator('#citizen-menu').getByRole('link', { name: 'Alerta ciudadana' }).click();
  await expect(page).toHaveURL(/alerta-ciudadana/);
  await page.screenshot({ path: 'test-results/report-mobile.png', fullPage: true });
});

test('proposal 3D model loads only when scrolled into view and replaces its poster', async ({ page }) => {
  // Short enough that the block sits below the fold plus the 200px preload margin.
  await page.setViewportSize({ width: 390, height: 400 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/propuestas/tecnologias-emergentes/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  // Vite pide `?url` para conocer la ruta; esa respuesta no carga el visor pesado.
  expect(requests.filter(u => /model-viewer|\.glb$/.test(u) && !new URL(u).searchParams.has('url'))).toEqual([]);
  await expect(page.locator('.model-3d-poster')).toBeVisible();
  await page.locator('.model-3d').scrollIntoViewIfNeeded();
  const viewer = page.locator('model-viewer');
  await expect.poll(() => viewer.evaluate((v: any) => v.loaded), { timeout: 30000 }).toBe(true);
  await expect(page.locator('.model-3d-poster')).toHaveCount(0);
  const size = await viewer.evaluate((v: any) => v.getDimensions());
  expect(size.x).toBeCloseTo(3.29, 2);
  expect(size.y).toBeCloseTo(1.419, 2);
  expect(errors).toEqual([]);
});

test('proposals without a model do not load the 3D viewer', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/propuestas/agua-potable/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await expect(page.locator('.model-3d')).toHaveCount(0);
  expect(requests.filter(u => /model-viewer|\.glb$/.test(u))).toEqual([]);
});

test('3D model respects reduced motion and zooms with the wheel only inside its frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('reduce-motion', 'true'));
  await page.goto('/propuestas/tecnologias-emergentes/');
  const viewer = page.locator('model-viewer');
  await expect.poll(() => viewer.evaluate((v: any) => v.loaded), { timeout: 30000 }).toBe(true);
  await expect(viewer).not.toHaveAttribute('auto-rotate');
  const radius = () => viewer.evaluate((v: any) => v.getCameraOrbit().radius);
  const scrollY = () => page.evaluate(() => window.scrollY);
  const before = await radius();
  await viewer.hover();
  const scrollInside = await scrollY();
  await page.mouse.wheel(0, -300);
  await expect.poll(radius).toBeLessThan(before);
  expect(await scrollY()).toBe(scrollInside);
  await page.mouse.move(1420, 950);
  await page.mouse.wheel(0, 200);
  await expect.poll(scrollY).toBeGreaterThan(scrollInside);
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).click();
  await page.getByRole('button', { name: 'Reducir movimiento' }).click();
  await expect(viewer).toHaveAttribute('auto-rotate', '');
});

test('3D model offers a retry button when the viewer fails to load', async ({ page }) => {
  let fail = true;
  await page.route('**/model-viewer*.js', route => (fail ? route.abort() : route.continue()));
  await page.goto('/propuestas/tecnologias-emergentes/');
  await page.locator('.model-3d').scrollIntoViewIfNeeded();
  const retry = page.getByRole('button', { name: 'Ver en 3D' });
  await expect(retry).toBeVisible();
  await expect(page.locator('.model-3d-poster')).toBeVisible();
  fail = false;
  await retry.click();
  await expect.poll(() => page.locator('model-viewer').evaluate((v: any) => v.loaded), { timeout: 30000 }).toBe(true);
  await expect(retry).toBeHidden();
});

test('las flechas del carrusel principal avanzan y retroceden dentro del carrusel', async ({ page }) => {
  await page.goto('/');
  const slides = page.locator('.hero-slides');
  await expect(slides.getByRole('button', { name: 'Diapositiva siguiente' })).toBeVisible();
  await slides.getByRole('button', { name: 'Diapositiva siguiente' }).click();
  await expect(page.locator('[data-slide="1"]')).toBeVisible();
  await slides.getByRole('button', { name: 'Diapositiva anterior' }).click();
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
});

for (const ancho of [390, 1440]) {
  test(`el botón de accesibilidad no se monta sobre «Volver arriba» a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto('/');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('.back-to-top')).toHaveClass(/is-visible/);
    const [a, b] = await Promise.all(['.back-to-top', '.access-toggle'].map(s =>
      page.locator(s).evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })));
    const separados = a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left;
    expect(separados).toBe(true);
  });
}

test('el modelo 3D entra y sale de pantalla completa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/propuestas/tecnologias-emergentes/');
  const boton = page.getByRole('button', { name: 'Ver en pantalla completa' });
  await expect(boton).toBeVisible({ timeout: 30000 });
  await boton.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('model-3d-visor'))).toBe(true);
  await page.getByRole('button', { name: 'Salir de pantalla completa' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test('sin la API de pantalla completa el visor ocupa la ventana y Escape lo cierra', async ({ page }) => {
  await page.addInitScript(() => { delete (Element.prototype as any).requestFullscreen; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/propuestas/tecnologias-emergentes/');
  // Con la franja de KPI el visor queda bajo el pliegue, y el modelo solo carga cuando se ve.
  await page.locator('.model-3d-visor').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Ver en pantalla completa' }).click({ timeout: 30000 });
  const visor = page.locator('.model-3d-visor');
  // Por clase y no por texto: las utilidades de Tailwind también contienen «is-expandido».
  const expandido = () => visor.evaluate(el => el.classList.contains('is-expandido'));
  await expect.poll(expandido).toBe(true);
  expect(await visor.evaluate(el => el.getBoundingClientRect().height)).toBe(844);
  await expect(page.locator('model-viewer')).toHaveAttribute('touch-action', 'none');
  await page.keyboard.press('Escape');
  await expect.poll(expandido).toBe(false);
  await expect(page.locator('model-viewer')).toHaveAttribute('touch-action', 'pan-y');
});

test('obras en ejecución muestra el avance y los hitos de cada propuesta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ciudadanía' }).hover();
  await page.locator('#citizen-menu').getByRole('link', { name: 'Obras en ejecución' }).click();
  await page.waitForURL('**/ciudadania/obras-en-ejecucion/');
  await expect(page.locator('.obra')).toHaveCount(7);
  await expect(page.getByText('Datos provisionales de ejemplo')).toBeVisible();
  const barra = page.getByRole('progressbar', { name: 'Avance de Agua potable' });
  await expect(barra).toHaveAttribute('aria-valuenow', '60');
  await expect(page.locator('.obra').first().getByRole('listitem')).toHaveCount(5);
  await page.locator('.obra').first().getByRole('link', { name: 'Ver propuesta' }).click();
  await page.waitForURL('**/propuestas/agua-potable/');
});

test('cada obra muestra su progreso junto a un carrusel de evidencias', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ciudadania/obras-en-ejecucion/');
  const carrusel = page.getByRole('region', { name: 'Evidencias del avance de Agua potable' });
  const tarjeta = page.locator('.obra').first();
  const [t, c] = await Promise.all([tarjeta, carrusel].map(l => l.evaluate(el => el.getBoundingClientRect())));
  expect(c.left).toBeGreaterThan(t.right);
  expect(Math.round(c.top)).toBe(Math.round(t.top));
  await expect(carrusel.locator('.evidencia:visible')).toHaveCount(1);
  await expect(carrusel.getByText('1 / 3')).toBeVisible();
  await carrusel.getByRole('button', { name: 'Foto siguiente' }).click();
  await expect(carrusel.getByText('2 / 3')).toBeVisible();
  await expect(carrusel.getByText('Foto provisional 2', { exact: true })).toBeVisible();
  await carrusel.getByRole('button', { name: 'Foto anterior' }).click();
  await carrusel.getByRole('button', { name: 'Foto anterior' }).click();
  await expect(carrusel.getByText('3 / 3')).toBeVisible();
  await expect(page.getByText('Aún no hay imágenes del avance de esta obra.')).toHaveCount(1);
});

test('en móvil las fotos de cada obra se despliegan desde un acordeón', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ciudadania/obras-en-ejecucion/');
  const boton = page.getByRole('button', { name: 'Fotos del avance (3)' }).first();
  const carrusel = page.getByRole('region', { name: 'Evidencias del avance de Agua potable' });
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
  await expect(carrusel).toBeHidden();
  await boton.click();
  await expect(boton).toHaveAttribute('aria-expanded', 'true');
  await expect(carrusel).toBeVisible();
  await carrusel.getByRole('button', { name: 'Foto siguiente' }).click();
  await expect(carrusel.getByText('2 / 3')).toBeVisible();
  await boton.click();
  await expect(carrusel).toBeHidden();
});
