import { test, expect } from '@playwright/test';

test('desktop navigation, carousel and accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Acerca de nosotros' })).toBeVisible();
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

test('suggestions validate and show an honest demo result', async ({ page }) => {
  await page.goto('/ciudadania/sugerencias/?tema=agua-potable');
  await expect(page.locator('#topic')).toHaveValue('agua-potable');
  await page.getByRole('button', { name: 'Enviar sugerencia' }).click();
  await expect(page.locator('.form-status')).toBeHidden();
  await page.locator('#message').fill('Esta es una sugerencia de prueba para mi sector.');
  await page.getByRole('button', { name: 'Enviar sugerencia' }).click();
  await expect(page.getByRole('status')).toContainText('Gracias por compartir tu mensaje');
});

test('citizen alert and chat work without external services', async ({ page }) => {
  await page.goto('/ciudadania/alerta-ciudadana/');
  await page.locator('#topic').fill('Sector de prueba');
  await page.locator('#message').fill('Descripción de una situación ficticia para probar el formulario.');
  await page.getByRole('button', { name: 'Enviar alerta' }).click();
  await expect(page.getByRole('status')).toContainText('Gracias por compartir tu mensaje');
  await page.goto('/ciudadania/chat/');
  await page.getByRole('button', { name: 'Ver propuestas' }).click();
  await expect(page.getByRole('log').getByRole('link', { name: 'Ver propuestas' })).toHaveAttribute('href', '/#propuestas');
  await page.locator('#chat-input').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect(page.locator('.from-user').last()).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.chat-messages img')).toHaveCount(0);
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

test('reporting is directly accessible on mobile and photo selection works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.proposal-card').first()).toHaveCSS('background-color', 'rgb(254, 255, 255)');
  await expect(page.locator('a[href="https://www.facebook.com/carlosastudillo7"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.tiktok.com/@carlosastudillo01"]')).toHaveCount(1);
  await page.getByRole('link', { name: 'Reportar daño', exact: true }).click();
  await expect(page).toHaveURL(/alerta-ciudadana/);
  // The page's script is an external module, so it attaches its listeners
  // after the document loads - without this the file input can receive the
  // change event before the handler exists (only reproducible against the
  // dev server, where modules are served unbundled).
  await page.waitForLoadState('load');
  await page.locator('#damage-photo').setInputFiles('src/assets/carlos.jpg');
  await expect(page.locator('.photo-preview')).toBeVisible();
  await expect(page.locator('.photo-name')).toHaveText('carlos.jpg');
  await page.getByRole('button', { name: 'Quitar foto' }).click();
  await expect(page.locator('.photo-preview')).toBeHidden();
  await page.locator('#damage-photo').setInputFiles({ name: 'archivo.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.locator('#photo-error')).toBeVisible();
  await page.locator('#damage-photo').setInputFiles({ name: 'grande.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(page.locator('#photo-error')).toBeVisible();
  await page.locator('#damage-photo').setInputFiles('src/assets/carlos.jpg');
  await expect(page.locator('#photo-error')).toBeHidden();
  await page.locator('#topic').fill('Barrio central');
  await page.locator('#message').fill('Hay un daño en la calle frente al parque.');
  await page.getByRole('button', { name: 'Enviar alerta' }).click();
  await expect(page.getByRole('status')).toContainText('Gracias por compartir tu mensaje');
  await page.screenshot({ path: 'test-results/report-mobile.png', fullPage: true });
});
