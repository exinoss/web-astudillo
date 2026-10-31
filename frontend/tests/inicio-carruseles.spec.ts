import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { mockPanelApi, panelData } from './support/panel-api';

async function abrirEdicion(page: Page, data = panelData('coadmin')) {
  await mockPanelApi(page, data);
  await page.goto('/');
  await page.getByRole('switch', { name: /Modo edición/ }).click();
  await expect(page.getByRole('switch', { name: /Modo edición/ })).toHaveAttribute('aria-checked', 'true');
  return data;
}
const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#2e86c1' } }).png().toBuffer();
const archivo = async (name: string, width = 2400, height = 914) => ({ name, mimeType: 'image/png', buffer: await png(width, height) });

test('la portada muestra los carruseles de la semilla y no ofrece editarlos a quien no edita', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Inicia sesión"}' }));
  await page.goto('/');
  await expect(page.locator('.hero-slides [data-slide]')).toHaveCount(2);
  await expect(page.locator('.slide-dot')).toHaveCount(2);
  await expect(page.locator('[data-profile-image]')).toHaveCount(3);
  await expect(page.locator('.profile-dot')).toHaveCount(3);
  await expect(page.locator('[data-slide="0"] img')).toHaveAttribute('fetchpriority', 'high');
  await expect(page.getByRole('button', { name: /Cambiar las imágenes/ })).toHaveCount(0);
});

test('sin permiso para subir fotos, el modo edición no muestra los botones de los carruseles', async ({ page }) => {
  const data = panelData('coadmin');
  data.profile.permisos = data.profile.permisos.filter(p => p !== 'medios.subir');
  await abrirEdicion(page, data);
  await expect(page.locator('[data-editable="inicio.participa.titulo"]')).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('button', { name: /Cambiar las imágenes/ })).toHaveCount(0);
});

test('añade un banner con imagen para celular, lo guarda una sola vez y la portada muestra el borrador hasta salir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const data = await abrirEdicion(page);
  const boton = page.getByRole('button', { name: 'Cambiar las imágenes del carrusel principal' });
  expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await boton.click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel principal' });
  await expect(dialogo).toBeVisible();
  const guardar = dialogo.getByRole('button', { name: 'Guardar borrador' });
  await expect(guardar).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Quitar banner 1' })).toBeDisabled();

  await dialogo.locator('#banners-nuevos').setInputFiles(await archivo('banner.png'));
  await expect(dialogo.getByText('Banner 2')).toBeVisible();
  await dialogo.locator('#banner-celular-1').setInputFiles(await archivo('celular.png', 1520, 1140));
  await expect(dialogo.locator('[data-quitar-celular="1"]')).toBeVisible();
  // Sin descripción no se guarda: el foco va al campo que falta.
  await guardar.click();
  await expect(page.getByRole('status').filter({ hasText: 'Describe cada imagen antes de guardar.' })).toBeVisible();
  await expect(dialogo.locator('#banner-alt-1')).toBeFocused();
  await dialogo.locator('#banner-alt-1').fill('Carlos con vecinos en el malecón');
  await guardar.dblclick();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome).toEqual([{
    clave: 'principal',
    banners: [
      { imagen: { original: 'portada' }, celular: null, alt: expect.stringContaining('PSC') },
      { imagen: { idMedio: 90 }, celular: 91, alt: 'Carlos con vecinos en el malecón' },
    ],
    retrato: { imagen: { original: 'pieza-respeto' }, alt: 'Retrato de Carlos Astudillo' },
  }]);
  await expect(page.getByRole('status').filter({ hasText: 'Guardado como borrador' })).toBeVisible();
  await expect(page.locator('#edicion-pendientes')).toHaveText('1 cambio sin publicar');

  // El borrador se ve en la portada: tres diapositivas y la nueva con su versión para celular.
  await expect(page.locator('.hero-slides [data-slide]')).toHaveCount(3);
  await expect(page.locator('.slide-dot')).toHaveCount(3);
  const nueva = page.locator('[data-slide="1"]');
  await expect(nueva.locator('picture source')).toHaveAttribute('media', '(width <= 760px)');
  await expect(nueva.locator('img')).toHaveAttribute('srcset', /foto-90-480\.webp 480w/);
  await expect(nueva.locator('[data-editable]')).toHaveCount(0);
  await expect(page.locator('[data-slide="0"] [data-editable="inicio.carrusel.titulo"]')).toHaveAttribute('tabindex', '0');
  await page.locator('.slide-next').click();
  await expect(nueva).toBeVisible();

  // Al salir del modo vuelve lo publicado.
  await page.getByRole('switch', { name: /Modo edición/ }).click();
  await expect(page.locator('.hero-slides [data-slide]')).toHaveCount(2);
  await expect(page.locator('.slide-dot')).toHaveCount(2);
  await expect(page.locator('[data-editable="inicio.carrusel.titulo"]').first()).not.toHaveAttribute('tabindex');
});

test('una foto de más de 40 megapíxeles se rechaza sin subirla ni mostrarla', async ({ page }) => {
  const data = await abrirEdicion(page);
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  const enorme = await sharp({ create: { width: 9000, height: 5000, channels: 3, background: '#2e86c1' } }).jpeg().toBuffer();
  await dialogo.locator('#piezas-nuevas').setInputFiles({ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: enorme });
  await expect(page.getByRole('status').filter({ hasText: 'La foto mide 45 megapíxeles; el máximo es 40' })).toBeVisible();
  expect(data.uploads).toBe(0);
  await expect(dialogo.locator('li')).toHaveCount(3);
  const mayor = await page.evaluate(() => Math.max(...[...document.images].map(i => i.naturalWidth * i.naturalHeight)));
  expect(mayor).toBeLessThan(4_000_000);
});

test('con una sola pieza no hay puntos y una pieza subida no se ve más grande que su archivo', async ({ page }) => {
  const data = await abrirEdicion(page);
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.locator('#piezas-nuevas').setInputFiles(await archivo('pieza.png', 1080, 1350));
  await expect(dialogo.locator('li')).toHaveCount(4);
  for (const n of [1, 1, 1]) await dialogo.getByRole('button', { name: `Quitar pieza ${n}` }).click();
  await expect(dialogo.getByRole('button', { name: 'Quitar pieza 1' })).toBeDisabled();
  await dialogo.locator('#pieza-alt-0').fill('Pieza nueva');
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome.at(-1)).toEqual({ clave: 'piezas', piezas: [{ imagen: { idMedio: 90 }, alt: 'Pieza nueva' }] });
  await expect(page.locator('[data-profile-image]')).toHaveCount(1);
  await expect(page.locator('.profile-dots')).toBeHidden();
  // La foto simulada mide 1600 × 1200: el tope sale de sus medidas.
  await expect(page.locator('[data-profile-image="0"]')).toHaveAttribute('style', /--ancho-foto: 1600px/);
});

test('subir y guardar muestran la animación de carga dentro del editor', async ({ page }) => {
  await abrirEdicion(page);
  await page.route('**/api/admin/{medios,contenido/inicio/piezas}', async route => { await new Promise(r => setTimeout(r, 800)); await route.fallback(); });
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  const carga = dialogo.locator('[role="status"]');
  await dialogo.locator('#piezas-nuevas').setInputFiles(await archivo('pieza.png', 1080, 1350));
  await expect(carga).toContainText('Subiendo…');
  await expect(dialogo.locator('li')).toHaveCount(4);
  await expect(carga).toHaveCount(0);
  await dialogo.locator('#pieza-alt-3').fill('Pieza nueva');
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(carga).toContainText('Guardando…');
  await expect(dialogo).toBeHidden();
});

test('si otra persona guardó antes, avisa sin cerrar el editor y no pisa su cambio', async ({ page }) => {
  const data = await abrirEdicion(page);
  data.draft.versiones.inicio.piezas = 'f'.repeat(32);
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.getByRole('button', { name: 'Bajar pieza 1' }).click();
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Otra persona guardó cambios' })).toBeVisible();
  await expect(dialogo).toBeVisible();
  expect(data.savedHome).toEqual([]);
});

test('el editor funciona con teclado, se cierra con Escape y no desborda la página', async ({ page }) => {
  await abrirEdicion(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const boton = page.getByRole('button', { name: 'Cambiar las imágenes del carrusel principal' });
    await boton.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog', { name: 'Carrusel principal' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Cerrar' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(boton).toBeFocused();
  }
});
