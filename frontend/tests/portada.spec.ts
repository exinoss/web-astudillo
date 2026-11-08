import { expect, test } from './support/prueba';

test('las cifras de la portada se ven grandes, con su texto, y cuentan hasta el valor', async ({ page }) => {
  await page.goto('/');
  const banda = page.locator('[data-cifras]');
  await banda.scrollIntoViewIfNeeded();
  await expect(banda.locator('[data-cifra="visitas"]')).toHaveText('12.480');
  await expect(banda.locator('[data-cifra="voces"]')).toHaveText('356');
  await expect(banda).toContainText('Visitas al sitio');
  await expect(banda).toContainText('Voces ciudadanas recibidas');
  await expect(page.getByText('Respeto', { exact: true })).toHaveCount(0);
  const tamano = await banda.locator('[data-cifra="visitas"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamano).toBeGreaterThanOrEqual(54);
});

test('«Personas que se sumaron» invita a sumarse solo a quien no tiene sesión', async ({ page }) => {
  await page.goto('/');
  const banda = page.locator('[data-cifras]');
  await banda.scrollIntoViewIfNeeded();
  await expect(banda.locator('[data-cifra="personas"]')).toHaveText('1.248');
  await expect(banda).toContainText('Personas que se sumaron');
  await expect(banda.getByRole('link', { name: 'Súmate' })).toHaveAttribute('href', '/cuenta/registro/');

  // Sesión real: si `/api/me` falla, el sitio borra la marca de sesión y vuelve a mostrar «Súmate».
  await page.route('**/api/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 1, correo: 'maria@example.com', rol: 'votante', nombresCompletos: 'María', direccion: '', tieneContrasenia: true, tieneGoogle: false, permisos: [],
  }) }));
  await page.addInitScript(() => localStorage.setItem('astudillo:sesion', '1'));
  const perfil = page.waitForResponse('**/api/me');
  await page.goto('/');
  await perfil;
  await page.waitForTimeout(300);
  await expect(page.locator('[data-cifras]').getByRole('link', { name: 'Súmate' })).toBeHidden();
});

test('con «Reducir movimiento» las cifras aparecen sin contar', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  const visitas = page.locator('[data-cifra="visitas"]');
  await visitas.scrollIntoViewIfNeeded();
  await expect(visitas).toHaveText('12.480');
});

test('las tarjetas de redes muestran el usuario sacado del enlace y no llevan línea inferior', async ({ page }) => {
  await page.goto('/#contacto');
  const contacto = page.locator('#contacto');
  const tarjeta = (nombre: string) => contacto.getByRole('link', { name: new RegExp(nombre) });
  await expect(tarjeta('Facebook')).toContainText('@carlosastudillo7');
  await expect(tarjeta('TikTok')).toContainText('@carlosastudillo01');
  await expect(tarjeta('WhatsApp')).toContainText('Mensaje directo');
  await expect(tarjeta('Instagram')).toHaveCount(0);
  await expect(contacto.getByText('Ir a Facebook')).toHaveCount(0);
  await expect(contacto.getByText('Ver en TikTok')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('el banner 1 amplía al candidato bajo el ratón, sin moverse con «Reducir movimiento», y no pasa de diapositiva', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const recorte = page.locator('[data-slide="0"] .silueta-recorte');
  const escala = () => recorte.evaluate((el) => getComputedStyle(el).transform);
  await page.locator('.hero-slides').hover({ position: { x: 1260, y: 200 } });
  await expect.poll(escala).toBe('matrix(1.05, 0, 0, 1.05, 0, 0)');
  await expect(page.locator('.silueta-portada image').first()).toHaveAttribute('href', /portada-sin-candidato/);
  await page.clock.runFor(7000);
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  await expect.poll(escala).toBe('none');
});

test('en celular el banner 1 muestra al candidato recortado sobre el público, sin descargar la foto de escritorio', async ({ page }) => {
  const pedidas: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()); });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  const banner = page.locator('[data-slide="0"]');
  await expect(banner.locator('img[src*="candidato-portada-recorte"]')).toBeVisible();
  await expect.poll(() => banner.locator('picture img').evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/fondo-publico-equipo/);
  await expect(banner.locator('.silueta-portada')).toBeHidden();
  expect(pedidas.filter((url) => /portada\.|portada-sin-candidato/.test(url))).toEqual([]);
});
