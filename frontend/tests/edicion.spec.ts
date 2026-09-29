import { expect, test } from '@playwright/test';
import { mockPanelApi, panelData } from './support/panel-api';

test('un visitante no descarga el editor', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', request => scripts.push(request.url()));
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Inicia sesión"}' }));
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  expect(scripts.filter(url => url.includes('modo-edicion'))).toEqual([]);
  await expect(page.getByRole('switch')).toHaveCount(0);
});

test('un coadmin edita un texto en el sitio, cancela con Escape y publica', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: /Modo edición/ });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  const title = page.locator('[data-editable="inicio.participa.titulo"]');
  await title.click();
  await page.keyboard.type('Tu voz importa.');
  await page.keyboard.press('Escape');
  await expect(title).toHaveText('Tu voz cuenta.');

  await title.click();
  await page.keyboard.type('Tu voz importa.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Guardado como borrador' })).toBeVisible();
  expect(data.draft.textos['inicio.participa.titulo']).toBe('Tu voz importa.');
  await expect(page.locator('#edicion-pendientes')).toHaveText('1 cambio sin publicar');

  // Un texto dentro de un enlace se edita en vez de navegar.
  await page.locator('footer [data-editable="pie.nombre"]').click();
  await page.keyboard.press('Escape');
  expect(new URL(page.url()).pathname).toBe('/');

  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Publicación en cola' })).toBeVisible();
  expect(data.publications).toHaveLength(1);

  // Al desactivarlo vuelve el texto publicado; el borrador sigue guardado.
  await toggle.click();
  await expect(title).toHaveText('Tu voz cuenta.');
});

test('«Editar en el sitio» abre el texto pedido y en móvil se edita en una hoja', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?editar=inicio.participa.antetitulo');
  const sheet = page.getByRole('dialog', { name: 'Editar texto' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('textbox')).toHaveValue('ESTAMOS PARA ESCUCHARTE');
  expect(new URL(page.url()).search).toBe('');
  await sheet.getByRole('textbox').fill('TE ESCUCHAMOS');
  await sheet.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-editable="inicio.participa.antetitulo"]')).toHaveText('TE ESCUCHAMOS');
  expect(data.draft.textos['inicio.participa.antetitulo']).toBe('TE ESCUCHAMOS');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(1);
  }
});
