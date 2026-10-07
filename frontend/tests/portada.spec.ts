import { expect, test } from '@playwright/test';

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
