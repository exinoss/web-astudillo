import { expect, test } from './support/prueba';
import { mockPanelApi, panelData } from './support/panel-api';

const ALCALDE = '/acerca-de-nosotros/por-que-quiero-ser-alcalde/';
const CONOCE = '/acerca-de-nosotros/conoce-mas/';
const MODES = ['grayscale', 'high-contrast', 'negative-contrast', 'light-bg', 'underline-links', 'readable-font', 'reduce-motion'];

test.beforeEach(async ({ page }) => {
  await page.route(/facebook\.com|tiktok\.com|youtube/, route => route.fulfill({ contentType: 'text/html', body: '<p>video</p>' }));
});

test('cada página muestra sus seis tarjetas fijas con su título editable y su texto como descripción', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const paginas = [[CONOCE, 'conoce-mas.tarjetas', 'Lo que me guía', '6. Respeto'], [ALCALDE, 'alcalde.tarjetas', 'Mis razones', '1. Primero la gente y especialmente los pobres']];
  for (const [path, clave, titulo, alt] of paginas) {
    await page.goto(path);
    await expect(page.locator('[data-card-scroll] img')).toHaveCount(6);
    await expect(page.getByRole('heading', { name: titulo, exact: true }).locator(`[data-editable="${clave}"]`)).toBeVisible();
    await expect(page.getByAltText(alt, { exact: true })).toHaveCount(1);
  }
  const cards = page.locator('[data-card-scroll] img');
  expect(Math.round((await cards.first().boundingBox())!.width)).toBe(260);
  await expect(cards.first()).toHaveAttribute('srcset', /\.webp 780w/);
  const strip = page.locator('[data-card-scroll]');
  const next = page.getByRole('button', { name: 'Ver tarjetas siguientes' });
  await expect(next).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver tarjetas anteriores' })).toBeDisabled();
  await page.waitForTimeout(800);
  expect(await strip.evaluate(e => e.scrollLeft)).toBe(0);
  await next.click();
  await expect.poll(() => strip.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
});

test('cada video se carga solo al pulsar, dentro de la página, y van en su orden', async ({ page }) => {
  await page.goto(ALCALDE);
  await expect(page.locator('[data-public-video] h2')).toHaveText(['Te cuento mis razones', 'Entrevista en Bambero TV']);
  await expect(page.locator('[data-public-video]').nth(1).getByRole('button', { name: 'Reproducir el video: Entrevista en Bambero TV' })).toBeVisible();
  const video = page.locator('[data-public-video]').first();
  await expect(video.getByRole('heading', { name: 'Te cuento mis razones' })).toBeVisible();
  expect(await video.locator('h2 + p').innerHTML()).toBe('Texto breve de prueba.<br>#LaNuevaHistoria');
  await expect(video.locator('iframe')).toHaveCount(0);
  await video.getByRole('button', { name: 'Reproducir el video: Te cuento mis razones' }).click();
  await expect(video.locator('iframe')).toHaveAttribute('src', /facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F28327883403549284%2F/);
  await expect(page.getByRole('link', { name: 'Ver propuestas' })).toHaveAttribute('href', '/#propuestas');
});

test('la página personal muestra entrevista y una galería accesible, sin retrato', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(CONOCE);
  await expect(page.locator('main header img')).toHaveCount(0);
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
  await dialog.locator('[data-visor-escena]').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
  // El desbloqueo va en el evento `close`, que el navegador dispara después de ocultar el diálogo.
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
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

const PIE_LARGO = 'Vecinos del barrio recorren con el equipo técnico la calle principal, donde ya se colocó la base del pavimento. '.repeat(3).slice(0, 300);
// Pone un pie de 300 caracteres a la primera foto antes de abrir el visor.
const alargarPie = (page: import('@playwright/test').Page) => page.locator('template[data-visor-foto]').first()
  .evaluate((t, texto) => { (t as HTMLTemplateElement).content.querySelector('figcaption')!.textContent = texto; }, PIE_LARGO);

test('en el visor el pie ocupa el ancho de la foto y en celular se recorta con «Ver más…»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(CONOCE);
  await alargarPie(page);
  await page.getByRole('button', { name: 'Ver todas (4)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Momentos en imágenes' });
  const anchos = () => dialog.locator('[data-visor-escena] figure').evaluate((f) => [f.querySelector('img')!, f.querySelector('figcaption')!].map(n => Math.round(n.getBoundingClientRect().width)));
  const [foto, pie] = await anchos();
  expect(pie).toBe(foto);
  await expect(dialog.getByRole('button', { name: 'Ver más…' })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ver todas (4)' }).click();
  const texto = dialog.locator('figcaption span');
  const recortado = (await texto.boundingBox())!.height;
  await dialog.getByRole('button', { name: 'Ver más…' }).click();
  await expect(dialog.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
  expect((await texto.boundingBox())!.height).toBeGreaterThan(recortado);
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
        await expect(page.locator('[data-card-scroll] img').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} ${mode} ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  }
});

test('el panel ya no ofrece tarjetas ni retrato, añade y quita videos, valida el enlace y guarda la página', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#acerca-de-carlos');
  const section = page.locator('#seccion-acerca-de-carlos');
  await expect(section.getByRole('heading', { name: 'Por qué quiero ser alcalde' })).toBeVisible();
  const save = section.getByRole('button', { name: 'Guardar borrador' });
  await expect(save).toBeDisabled();
  await expect(section.getByRole('button', { name: 'Tarjetas' })).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Videos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(section.getByText('Aún no hay videos.')).toBeVisible();
  await section.getByRole('button', { name: 'Añadir video' }).click();
  await expect(section.getByLabel('Título', { exact: true })).toBeFocused();
  await section.getByLabel('Título', { exact: true }).fill('Te cuento mis razones');
  await section.getByLabel('Enlace del video').fill('https://example.com/video');
  await expect(section.getByText('Pega el enlace de un video de Facebook, TikTok, YouTube o Vimeo.')).toBeVisible();
  await section.getByLabel('Enlace del video').fill('https://www.facebook.com/share/v/1MyuBerxTu/');
  await expect(section.getByText(/enlace corto para compartir/)).toBeVisible();
  await section.getByLabel('Enlace del video').fill('https://www.tiktok.com/@scout2015/video/6718335390845095173');
  await expect(section.getByText('Enlace válido · TikTok')).toBeVisible();
  await expect(section.getByLabel('Enlace del video')).toHaveCSS('border-color', 'rgb(30, 122, 60)');
  await expect(section.getByLabel('Vertical')).toBeChecked();
  await section.getByRole('button', { name: 'Ver video' }).click();
  await expect(section.locator('#video-escenario-0 iframe')).toHaveAttribute('src', /tiktok\.com\/player\/v1\/6718335390845095173/);

  // Un segundo video se añade debajo y su botón rojo lo quita.
  await section.getByRole('button', { name: 'Añadir video' }).click();
  await expect(section.locator('#video-titulo-1')).toBeVisible();
  const quitar = section.locator('[data-remove="video"][data-index="1"]');
  await expect(quitar).toHaveText('Quitar video');
  await expect(quitar).toHaveCSS('color', 'rgb(165, 9, 19)');
  await quitar.click();
  await expect(section.locator('#video-titulo-1')).toHaveCount(0);

  await page.goto('/cuenta/panel/#acerca-de-carlos');
  await section.getByLabel('Página', { exact: true }).selectOption('conoce-mas');
  await expect(section.locator('[data-acerca-seccion]')).toHaveText(['Videos', 'Entrevista', 'Galería']);
  await section.getByLabel('Página', { exact: true }).selectOption('por-que-quiero-ser-alcalde');
  await expect(section.locator('#video-titulo-0')).toHaveValue('Te cuento mis razones');

  await save.click();
  await expect(page.locator('[data-notificacion]')).toContainText('Guardado como borrador');
  expect(data.savedPages.at(-1)).toMatchObject({
    slug: 'por-que-quiero-ser-alcalde',
    videos: [{ titulo: 'Te cuento mis razones', enlace: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', vertical: true, idPortada: null }],
  });
  expect(data.savedPages.at(-1)).not.toHaveProperty('retrato');
  expect(data.savedPages.at(-1)).not.toHaveProperty('tarjetas');
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
  await expect(page.locator('[data-notificacion]')).toContainText('Guardado como borrador');
  expect(data.savedPages.at(-1)).toMatchObject({ slug: 'conoce-mas', entrevista: [{ pregunta: '¿Qué significa San Lorenzo para ti?', respuesta: 'Mi casa.' }] });
});

test('la portada sigue al enlace: se toma al pegarlo, se quita al cambiarlo y vuelve con el enlace anterior', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#acerca-de-carlos');
  const section = page.locator('#seccion-acerca-de-carlos');
  const REEL = 'https://www.facebook.com/reel/28327883403549284/';
  await section.getByRole('button', { name: 'Añadir video' }).click();
  await section.getByLabel('Título', { exact: true }).fill('Te cuento mis razones');
  const enlace = section.getByLabel('Enlace del video');
  const portada = section.locator('#video-escenario-0 img');
  await enlace.fill(REEL);
  await enlace.press('Tab');
  await expect(page.locator('#panel-estado')).toContainText('Se usa la imagen del video como portada');
  await expect(portada).toHaveAttribute('src', /foto-91/);
  await expect(section.locator('[name="video-formato-0"][value="vertical"]')).toBeFocused();

  // El tacho rojo quita la portada y «Usar la imagen del video» la vuelve a pedir.
  const tacho = section.getByRole('button', { name: 'Quitar la portada del video 1' });
  await expect(tacho).toHaveCSS('color', 'rgb(165, 9, 19)');
  await tacho.click();
  await expect(portada).toHaveCount(0);
  await section.getByRole('button', { name: 'Usar la imagen del video' }).click();
  await expect(portada).toHaveAttribute('src', /foto-91/);

  // Otro enlace quita la portada del anterior y pide la suya; esta plataforma no la da.
  await enlace.fill('https://vimeo.com/76979871');
  await enlace.press('Tab');
  await expect(page.locator('#panel-estado')).toContainText('No se pudo obtener la imagen de este video');
  await expect(portada).toHaveCount(0);
  await enlace.fill('https://example.com/video.mp4');
  await enlace.press('Tab');
  await expect(section.getByRole('button', { name: 'Usar la imagen del video' })).toBeHidden();

  // Al volver al enlace anterior vuelve su imagen, sin pulsar nada.
  await enlace.fill(REEL);
  await enlace.press('Tab');
  await expect(portada).toHaveAttribute('src', /foto-91/);
  expect(data.videoCovers).toEqual([REEL, REEL, 'https://vimeo.com/76979871', REEL]);
  await section.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('[data-notificacion]')).toContainText('Guardado como borrador');
  expect(data.savedPages.at(-1)).toMatchObject({ videos: [{ enlace: REEL, idPortada: 91 }] });
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
