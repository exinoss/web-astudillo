import { expect, test } from '@playwright/test';
import { mockPanelApi, panelData } from './support/panel-api';

const ALCALDE = '/acerca-de-nosotros/por-que-quiero-ser-alcalde/';
const CONOCE = '/acerca-de-nosotros/conoce-mas/';
const MODES = ['grayscale', 'high-contrast', 'negative-contrast', 'light-bg', 'underline-links', 'readable-font', 'reduce-motion'];

test.beforeEach(async ({ page }) => {
  await page.route(/facebook\.com|tiktok\.com|youtube/, route => route.fulfill({ contentType: 'text/html', body: '<p>video</p>' }));
});

test('las tarjetas se navegan sin avanzar solas y el texto se abre en la misma tarjeta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ALCALDE);
  const cards = page.locator('[data-carlos-card]');
  await expect(cards).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Mis razones', exact: true })).toBeVisible();
  const strip = page.locator('[data-card-scroll]');
  const next = page.getByRole('button', { name: 'Ver tarjetas siguientes' });
  await expect(next).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver tarjetas anteriores' })).toBeDisabled();
  await page.waitForTimeout(800);
  expect(await strip.evaluate(e => e.scrollLeft)).toBe(0);
  await next.click();
  await expect.poll(() => strip.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);

  const heights = () => cards.evaluateAll(list => list.map(c => Math.round(c.getBoundingClientRect().height)));
  const closed = await heights();
  await cards.first().locator('summary').click();
  await expect(cards.first().locator('summary p')).toHaveText('Texto de prueba de la tarjeta «Escuchar a su gente».');
  await expect(cards.first().locator('summary p')).toBeVisible();
  await expect(cards.first().getByText('Leer menos')).toBeVisible();
  expect(await heights()).toEqual(closed);
  await cards.first().locator('summary').press('Enter');
  await expect(cards.first().getByText('Leer más')).toBeVisible();
});

test('el video se carga solo al pulsar, dentro de la página', async ({ page }) => {
  await page.goto(ALCALDE);
  const video = page.locator('[data-public-video]');
  await expect(video.getByRole('heading', { name: 'Te cuento mis razones' })).toBeVisible();
  expect(await video.locator('h2 + p').innerHTML()).toBe('Texto breve de prueba.<br>#LaNuevaHistoria');
  await expect(video.locator('iframe')).toHaveCount(0);
  await video.getByRole('button', { name: 'Reproducir el video: Te cuento mis razones' }).click();
  await expect(video.locator('iframe')).toHaveAttribute('src', /facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F28327883403549284%2F/);
  await expect(page.getByRole('link', { name: 'Ver propuestas' })).toHaveAttribute('href', '/#propuestas');
});

test('la página personal muestra retrato, entrevista y una galería accesible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(CONOCE);
  await expect(page.getByRole('img', { name: 'Retrato de prueba' })).toBeVisible();
  await page.getByText('¿Qué significa San Lorenzo para ti?').click();
  await expect(page.getByText('Respuesta de prueba.', { exact: true })).toBeVisible();
  const open = page.getByRole('button', { name: 'Ver todas (4)' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Momentos en imágenes' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1 / 4')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText('2 / 4')).toBeVisible();
  await expect(dialog.getByText('Pie de prueba 2')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  const thumbs = dialog.getByRole('group', { name: 'Elegir foto' }).getByRole('button');
  await expect(thumbs).toHaveCount(4);
  await thumbs.nth(2).click();
  await expect(dialog.getByText('3 / 4')).toBeVisible();
  await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(dialog.getByRole('button', { name: 'Foto siguiente' }).first()).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await dialog.locator('[data-dialog-stage]').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await expect(page.getByRole('link', { name: 'Conoce mi trayectoria' })).toHaveAttribute('href', '/acerca-de-nosotros/biografia/');
});

test('en móvil el visor ocupa toda la pantalla y se avanza con los botones de abajo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CONOCE);
  await page.getByRole('button', { name: 'Ver todas (4)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Momentos en imágenes' });
  const box = (await dialog.boundingBox())!;
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([390, 844]);
  await dialog.getByRole('button', { name: 'Foto siguiente' }).last().click();
  await expect(dialog.getByText('2 / 4')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('en móvil la galería avanza con botones y contador', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CONOCE);
  const gallery = page.locator('[data-gallery]');
  await gallery.getByRole('button', { name: 'Foto siguiente' }).first().click();
  await expect(gallery.getByText('2 / 4').first()).toBeVisible();
  await expect(gallery.locator('[data-mobile-stage] img')).toHaveAttribute('alt', 'Foto de prueba 2');
});

test('las dos páginas no se desbordan de 320 px a escritorio, con los modos de accesibilidad', async ({ page }) => {
  for (const path of [ALCALDE, CONOCE]) {
    await page.goto(path);
    for (const mode of [null, ...MODES]) {
      await page.evaluate(m => { document.documentElement.className = m ?? ''; }, mode);
      for (const width of [320, 390, 760, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('[data-carlos-card]').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} ${mode} ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  }
});

test('el panel edita una tarjeta con vista previa, valida el video y guarda la página', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#acerca-de-carlos');
  const section = page.locator('#seccion-acerca-de-carlos');
  await expect(section.getByRole('heading', { name: 'Por qué quiero ser alcalde' })).toBeVisible();
  const save = section.getByRole('button', { name: 'Guardar borrador' });
  await expect(save).toBeDisabled();
  await section.getByLabel('Título').fill('Atender lo cotidiano');
  await expect(section.locator('#tarjeta-vista [data-card-title]')).toHaveText('Atender lo cotidiano');
  await section.getByText('Azul', { exact: true }).click();
  await expect(section.locator('#tarjeta-vista [data-carlos-card]')).toHaveAttribute('style', /--mask-color:#284e9c/);

  await section.getByRole('button', { name: 'Video', exact: true }).click();
  await section.getByLabel('Título de la sección').fill('Te cuento mis razones');
  await section.getByLabel('Enlace del video').fill('https://example.com/video');
  await expect(section.getByText('Pega el enlace de un video de Facebook, TikTok, YouTube o Vimeo.')).toBeVisible();
  await section.getByLabel('Enlace del video').fill('https://www.facebook.com/share/v/1MyuBerxTu/');
  await expect(section.getByText(/enlace corto para compartir/)).toBeVisible();
  await section.getByLabel('Enlace del video').fill('https://www.tiktok.com/@scout2015/video/6718335390845095173');
  await expect(section.getByText('Enlace válido · TikTok')).toBeVisible();
  await expect(section.getByLabel('Enlace del video')).toHaveCSS('border-color', 'rgb(30, 122, 60)');
  await expect(section.getByLabel('Vertical')).toBeChecked();
  await section.getByRole('button', { name: 'Ver video' }).click();
  await expect(section.locator('#video-escenario iframe')).toHaveAttribute('src', /tiktok\.com\/player\/v1\/6718335390845095173/);

  await save.click();
  await expect(page.locator('#panel-estado')).toContainText('Borrador de «Por qué quiero ser alcalde» guardado');
  expect(data.savedPages.at(-1)).toMatchObject({
    slug: 'por-que-quiero-ser-alcalde',
    tarjetas: [{ idMedio: 3, titulo: 'Atender lo cotidiano', color: 'azul' }],
    video: { titulo: 'Te cuento mis razones', enlace: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', vertical: true, idPortada: null },
  });
  await expect(page.locator('#panel-publicar')).toContainText('Publicar cambios (1)');
});

test('el panel de la página personal añade entrevista y exige completar los campos', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#acerca-de-carlos');
  const section = page.locator('#seccion-acerca-de-carlos');
  await section.getByLabel('Página', { exact: true }).selectOption('conoce-mas');
  await expect(section.getByRole('button', { name: 'Galería' })).toBeVisible();
  await section.getByRole('button', { name: 'Entrevista' }).click();
  await section.getByRole('button', { name: 'Añadir pregunta' }).click();
  await section.getByLabel('Pregunta', { exact: true }).fill('¿Qué significa San Lorenzo para ti?');
  await section.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('Completa la pregunta y la respuesta');
  await section.getByLabel('Respuesta').fill('Mi casa.');
  await section.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('Borrador de «Conoce más sobre Carlos» guardado');
  expect(data.savedPages.at(-1)).toMatchObject({ slug: 'conoce-mas', entrevista: [{ pregunta: '¿Qué significa San Lorenzo para ti?', respuesta: 'Mi casa.' }] });
});

test('el editor abre la vista previa del borrador en la página que se edita', async ({ page }) => {
  const data = panelData('coadmin');
  data.pending = [{ tipo: 'Texto', descripcion: 'pie.lema' }];
  await mockPanelApi(page, data);
  await page.context().route('**/cuenta/vista-previa/**', route => route.fulfill({ contentType: 'text/html', body: '<p>vista previa</p>' }));
  await page.goto('/cuenta/panel/#acerca-de-carlos');
  const section = page.locator('#seccion-acerca-de-carlos');
  await section.getByLabel('Página', { exact: true }).selectOption('conoce-mas');
  const [preview] = await Promise.all([page.waitForEvent('popup'), section.getByRole('button', { name: 'Vista previa del borrador' }).click()]);
  await preview.waitForURL('**/cuenta/vista-previa/?ruta=%2Facerca-de-nosotros%2Fconoce-mas%2F');
});
