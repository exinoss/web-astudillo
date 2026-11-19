import { expect, test, type Page } from './support/prueba';
import sharp from 'sharp';
import { mockPanelApi, panelData } from './support/panel-api';
import { AVISO_ENLACE_BOTON } from '../../backend/src/contracts/inicio';

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
  await expect(page.locator('[data-slide="0"] picture img')).toHaveAttribute('fetchpriority', 'high');
  await expect(page.getByRole('button', { name: /Cambiar las imágenes/ })).toHaveCount(0);
  await expect(page.locator('[data-boton-diapositiva]')).toHaveAttribute('href', '/acerca-de-nosotros/');
  await expect(page.locator('[data-boton-diapositiva]')).toHaveText('Conoce a Carlos');
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
  await expect(dialogo.getByRole('button', { name: 'Quitar banner 1' })).toHaveCount(0);
  // El banner 1 tiene su propia versión para celular: no ofrece subir otra.
  await expect(dialogo.getByText('Este banner ya tiene su versión para celular.')).toBeVisible();
  await expect(dialogo.locator('#banner-celular-0')).toHaveCount(0);

  await dialogo.locator('#banners-nuevos').setInputFiles(await archivo('banner.png'));
  await expect(dialogo.getByText('Banner 2')).toBeVisible();
  // El primero queda fijo: ni él baja ni el segundo sube a su lugar.
  await expect(dialogo.getByRole('button', { name: 'Quitar banner 1' })).toHaveCount(0);
  await expect(dialogo.getByRole('button', { name: 'Bajar banner 1' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Subir banner 2' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Quitar banner 2' })).toBeEnabled();
  await dialogo.locator('#banner-celular-1').setInputFiles(await archivo('celular.png', 1520, 1140));
  await expect(dialogo.locator('[data-quitar-celular="1"]')).toBeVisible();
  // Sin descripción no se guarda: el campo que falta se marca como en el panel y recibe el foco.
  await guardar.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Describe cada imagen antes de guardar.' })).toBeVisible();
  await expect(dialogo.locator('#banner-alt-1')).toBeFocused();
  await expect(dialogo.locator('#banner-alt-1')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialogo.locator('#banner-alt-1-error')).toHaveText('Completa este campo.');
  await expect(dialogo.locator('#banner-alt-0')).not.toHaveAttribute('aria-invalid');
  await dialogo.locator('#banner-alt-1').fill('Carlos con vecinos en el malecón');
  await expect(dialogo.locator('#banner-alt-1-error')).toBeHidden();
  await guardar.dblclick();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome).toEqual([{
    clave: 'principal',
    banners: [
      { imagen: { original: 'portada' }, celular: null, alt: expect.stringContaining('PSC') },
      { imagen: { idMedio: 90 }, celular: 91, alt: 'Carlos con vecinos en el malecón' },
    ],
    retrato: { imagen: { original: 'pieza-respeto' }, alt: 'Retrato de Carlos Astudillo' },
    enlace: '/acerca-de-nosotros/',
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
  await expect(page.locator('[data-slide="0"] .silueta-portada polygon')).toHaveCount(1);
  await page.locator('.slide-next').click();
  await expect(nueva).toBeVisible();

  // Al salir del modo vuelve lo publicado.
  await page.getByRole('switch', { name: /Modo edición/ }).click();
  await expect(page.locator('.hero-slides [data-slide]')).toHaveCount(2);
  await expect(page.locator('.slide-dot')).toHaveCount(2);
  await expect(page.locator('[data-editable="inicio.carrusel.titulo"]').first()).not.toHaveAttribute('tabindex');
});

test('el botón de la segunda diapositiva lleva a una página, a un enlace externo o a ninguna, y su texto se edita en la diapositiva', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const data = await abrirEdicion(page);
  const boton = page.locator('[data-slide="1"] [data-boton-diapositiva]');
  await page.locator('.slide-next').click();
  await expect(boton.locator('[data-editable="inicio.carrusel-2.boton"]')).toHaveAttribute('tabindex', '0');
  await boton.locator('[data-editable="inicio.carrusel-2.boton"]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press('Escape');

  const abrir = page.getByRole('button', { name: 'Cambiar las imágenes del carrusel principal' });
  const dialogo = page.getByRole('dialog', { name: 'Carrusel principal' });
  const interruptor = dialogo.getByRole('switch', { name: 'Enlace externo' });
  const pagina = dialogo.getByLabel('Página', { exact: true });
  const url = dialogo.getByLabel('Enlace', { exact: true });
  const guardar = dialogo.getByRole('button', { name: 'Guardar borrador' });
  await abrir.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  expect((await interruptor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(pagina).toHaveValue('/acerca-de-nosotros/');
  await expect(url).toBeHidden();
  await pagina.selectOption({ label: 'Mi equipo' });
  await guardar.click();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome.at(-1)).toMatchObject({ clave: 'principal', enlace: '/mi-equipo/' });
  await expect(boton).toHaveAttribute('href', '/mi-equipo/');

  await abrir.click();
  await interruptor.press('Enter');
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await expect(pagina).toBeHidden();
  await guardar.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Pega el enlace del botón o elige una página del sitio.' })).toBeVisible();
  await url.fill('https://ejemplo.com/video');
  await guardar.click();
  await expect(page.getByRole('alert').filter({ hasText: AVISO_ENLACE_BOTON })).toBeVisible();
  await expect(url).toHaveAttribute('aria-invalid', 'true');
  await url.fill('https://www.facebook.com/watch/?v=123');
  await guardar.dblclick();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome.at(-1)).toMatchObject({ enlace: 'https://www.facebook.com/watch/?v=123' });
  await expect(boton).toHaveAttribute('target', '_blank');
  await expect(boton).toHaveAttribute('rel', 'noopener noreferrer');

  await abrir.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await expect(url).toHaveValue('https://www.facebook.com/watch/?v=123');
  await interruptor.click();
  await pagina.selectOption('');
  await guardar.click();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome.at(-1)).toMatchObject({ enlace: '' });
  await expect(boton).not.toHaveAttribute('href');
  await expect(boton).toHaveCSS('cursor', 'not-allowed');
  expect(data.savedHome).toHaveLength(3);
});

for (const ancho of [1440, 390]) {
  test(`a ${ancho} px el carrusel principal no cambia de diapositiva mientras se edita un texto`, async ({ page }) => {
    await abrirEdicion(page);
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.clock.install();
    await page.locator('.slide-next').click();
    const segunda = page.locator('[data-slide="1"]');
    await expect(segunda).toBeVisible();
    await segunda.locator('[data-editable="inicio.carrusel-2.titulo"]').click();
    await page.clock.runFor(20_000);
    await expect(segunda).toBeVisible();
    await page.keyboard.press('Escape');
    await page.clock.runFor(7_000);
    await expect(segunda).toBeHidden();
  });
}

test('el retrato de la semilla se recorta y uno subido se ve completo y no más grande que su archivo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirEdicion(page);
  // Sin avance automático: con la máquina cargada, el carrusel escondía la diapositiva mientras se medía.
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  const retrato = page.locator('[data-slide="1"] img');
  await expect(retrato).toHaveCSS('object-fit', 'cover');
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel principal' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel principal' });
  await dialogo.locator('#retrato-nuevo').setInputFiles(await archivo('retrato.png', 1600, 1200));
  await dialogo.locator('#retrato-alt').fill('Afiche de la entrevista');
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialogo).toBeHidden({ timeout: 15000 });
  for (const ancho of [1440, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.locator('.slide-dot').last().click();
    await expect(retrato).toBeVisible();
    await expect(retrato).toHaveCSS('object-fit', 'contain');
    expect((await retrato.boundingBox())!.width).toBeLessThanOrEqual(1600);
  }
});

test('mientras se sube el retrato no se puede guardar y la descripción escrita no se pierde',async ({ page }) => {
  await abrirEdicion(page);
  await page.route('**/api/admin/medios', async (route) => { await new Promise(r => setTimeout(r, 500)); await route.fallback(); });
  await page.getByRole('button', { name: 'Cambiar las imágenes del carrusel principal' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel principal' });
  await dialogo.locator('#retrato-nuevo').setInputFiles(await archivo('retrato.png', 1600, 1200));
  await dialogo.locator('#retrato-alt').fill('Afiche de la entrevista');
  await expect(dialogo.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Imagen subida' })).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled();
  await expect(dialogo.locator('#retrato-alt')).toHaveValue('Afiche de la entrevista');
});

test('una foto de más de 40 megapíxeles se rechaza sin subirla ni mostrarla', async ({ page }) => {
  const data = await abrirEdicion(page);
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  const enorme = await sharp({ create: { width: 9000, height: 5000, channels: 3, background: '#2e86c1' } }).jpeg().toBuffer();
  await dialogo.locator('#piezas-nuevas').setInputFiles({ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: enorme });
  await expect(page.getByRole('alert').filter({ hasText: 'La foto mide 45 megapíxeles; el máximo es 40' })).toBeVisible();
  expect(data.uploads).toBe(0);
  await expect(dialogo.locator('li')).toHaveCount(3);
  const mayor = await page.evaluate(() => Math.max(...[...document.images].map(i => i.naturalWidth * i.naturalHeight)));
  expect(mayor).toBeLessThan(4_000_000);
});

test('con una sola pieza no hay puntos y una pieza subida no se ve más grande que su archivo', async ({ page }) => {
  const data = await abrirEdicion(page);
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.locator('#piezas-nuevas').setInputFiles(await archivo('pieza.png', 1080, 1350));
  await expect(dialogo.locator('li')).toHaveCount(4);
  for (const n of [1, 1, 1]) await dialogo.getByRole('button', { name: `Quitar imagen ${n}` }).click();
  await expect(dialogo.getByRole('button', { name: 'Quitar imagen 1' })).toBeDisabled();
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
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  const carga = dialogo.locator('[role="status"]:not([data-notificacion])');
  await dialogo.locator('#piezas-nuevas').setInputFiles(await archivo('pieza.png', 1080, 1350));
  await expect(carga).toContainText('Subiendo…');
  await expect(dialogo.locator('li')).toHaveCount(4);
  await expect(carga).toHaveCount(0);
  await dialogo.locator('#pieza-alt-3').fill('Pieza nueva');
  // Tras la carga, nada de la lista desborda la ventana: si lo hiciera, el pie con «Guardar borrador» se desplazaría.
  expect(await dialogo.evaluate(el => el.firstElementChild!.scrollHeight - el.firstElementChild!.clientHeight)).toBe(0);
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(carga).toContainText('Guardando…');
  await expect(dialogo).toBeHidden();
});

test('si otra persona guardó antes, avisa sin cerrar el editor y no pisa su cambio', async ({ page }) => {
  const data = await abrirEdicion(page);
  data.draft.versiones.inicio.piezas = 'f'.repeat(32);
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.getByRole('button', { name: 'Bajar imagen 1' }).click();
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  const aviso = page.getByRole('alert').filter({ hasText: 'Otra persona guardó cambios' });
  await expect(aviso).toBeVisible();
  // El aviso queda encima de la ventana abierta y se puede cerrar.
  await aviso.getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(aviso).toHaveCount(0);
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

test('el carrusel del equipo muestra sus fotos completas, cambia con los puntos y abre el visor; en celular no desborda', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Inicia sesión"}' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const carrusel = page.getByRole('region', { name: 'Carlos Astudillo y su equipo' });
  await expect(carrusel).toBeVisible();
  // Va antes de «Propuestas» y con el marco del primer carrusel.
  expect(await page.evaluate(() => document.querySelector('[data-carrusel-editable="equipo"]')!.nextElementSibling!.id)).toBe('propuestas');
  const [marco, primero] = await Promise.all([carrusel.locator('[data-diapositiva]').first(), page.locator('.hero-slides [data-slide="0"]')].map(l => l.boundingBox()));
  expect(Math.round(marco!.height)).toBe(Math.round(primero!.height));
  // La foto de prueba mide 1600 × 1200: no se dibuja más grande que su archivo.
  const foto = carrusel.getByRole('img', { name: 'Foto del equipo de prueba 1' });
  expect((await foto.boundingBox())!.width).toBeLessThanOrEqual(1600);
  await carrusel.getByRole('button', { name: 'Ver imagen 2' }).click();
  await expect(carrusel.getByRole('img', { name: 'Foto del equipo de prueba 2' })).toBeVisible();
  await expect(carrusel.getByRole('button', { name: 'Ver imagen 2' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.slide-dot')).toHaveCount(2);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(0);
  }
  // En celular la foto usa todo el ancho y los controles van debajo, sin taparla.
  await page.setViewportSize({ width: 390, height: 800 });
  const imagen = (await carrusel.getByRole('img', { name: 'Foto del equipo de prueba 2' }).boundingBox())!;
  const controles = (await carrusel.getByRole('group', { name: 'Controles del carrusel del equipo' }).boundingBox())!;
  expect(Math.round(imagen.width)).toBe(390);
  expect(controles.y).toBeGreaterThanOrEqual(imagen.y + imagen.height - 1);
  const ampliar = carrusel.getByRole('button', { name: 'Ampliar: Foto del equipo de prueba 2' });
  await ampliar.click();
  const visor = page.getByRole('dialog', { name: 'Carlos Astudillo y su equipo' });
  await expect(visor).toBeVisible();
  await expect(visor.locator('[data-visor-contador]')).toHaveText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(ampliar).toBeFocused();
});

test('el carrusel del equipo se edita: sin fotos ofrece agregarlas, rechaza las verticales y guarda las horizontales', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const data = await abrirEdicion(page);
  // El borrador no tiene fotos: en vez del carrusel publicado se ve la franja para agregarlas.
  await expect(page.getByText('Aún no tiene imágenes y no se muestra en el sitio.')).toBeVisible();
  await expect(page.locator('[data-carrusel-editable="equipo"] [data-diapositiva]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar imágenes al carrusel del equipo' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel del equipo' });
  await expect(dialogo.getByText('Hasta 8 · imágenes horizontales · 2000 × 761 px · Máximo 8 MB.')).toBeVisible();
  for (const [name, width, height] of [['vertical.png', 900, 1200], ['cuadrada.png', 1000, 1000]] as const) {
    await dialogo.locator('#equipo-nuevas').setInputFiles(await archivo(name, width, height));
    await expect(page.getByRole('alert').filter({ hasText: 'En este carrusel solo van imágenes horizontales (más anchas que altas).' })).toBeVisible();
  }
  expect(data.uploads).toBe(0);
  await dialogo.locator('#equipo-nuevas').setInputFiles(await archivo('equipo.png', 2000, 761));
  await expect(dialogo.getByText('Imagen 1')).toBeVisible();
  await dialogo.locator('#equipo-alt-0').fill('Carlos con su equipo');
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).dblclick();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome).toEqual([{ clave: 'equipo', fotos: [{ idMedio: 90, alt: 'Carlos con su equipo' }] }]);
  await expect(page.getByText('Aún no tiene imágenes y no se muestra en el sitio.')).toBeHidden();
  const borrador = page.locator('[data-carrusel-editable="equipo"] [data-diapositiva] img');
  await expect(borrador).toHaveCount(1);
  await expect(borrador).toHaveAttribute('srcset', /foto-90-480\.webp 480w/);
  await expect(page.getByRole('button', { name: 'Cambiar las imágenes del carrusel del equipo' })).toBeVisible();
  // Al salir del modo vuelven las fotos publicadas, con su visor.
  await page.getByRole('switch', { name: /Modo edición/ }).click();
  await expect(page.locator('[data-carrusel-editable="equipo"] [data-diapositiva]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Ampliar: Foto del equipo de prueba 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /carrusel del equipo/ })).toHaveCount(0);
});

const REEL = 'https://www.facebook.com/reel/28327883403549284/';

test('añade un video al carrusel de piezas con la portada de su plataforma, lo guarda una vez y se reproduce sin el efecto de vidrio', async ({ page }) => {
  await page.route(/facebook\.com|tiktok\.com|youtube/, route => route.fulfill({ contentType: 'text/html', body: '<p>video</p>' }));
  const data = await abrirEdicion(page);
  await page.clock.install();
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.getByRole('button', { name: 'Añadir video' }).click();
  await expect(dialogo.locator('#video-titulo-3')).toBeFocused();
  await dialogo.locator('#video-titulo-3').fill('Te cuento mis razones');
  await dialogo.locator('#video-enlace-3').fill('https://fb.watch/abc/');
  await expect(dialogo.locator('#video-detectado-3')).toContainText('enlace corto');
  await dialogo.locator('#video-enlace-3').fill(REEL);
  await expect(dialogo.locator('#video-detectado-3')).toContainText('Enlace válido · Facebook');
  await expect(dialogo.locator('[name="video-formato-3"][value="vertical"]')).toBeChecked();
  await dialogo.locator('#video-enlace-3').blur();
  await expect(dialogo.getByRole('button', { name: 'Quitar la portada del video 4' })).toBeVisible();
  expect(data.videoCovers).toEqual([REEL]);
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).dblclick();
  await expect(dialogo).toBeHidden();
  expect(data.savedHome).toHaveLength(1);
  expect((data.savedHome[0].piezas as unknown[]).at(-1)).toEqual({ video: { titulo: 'Te cuento mis razones', enlace: REEL, vertical: true, idPortada: 91 } });

  const carrusel = page.locator('[data-carrusel-editable="piezas"]');
  const cortina = carrusel.locator('.profile-glass-curtain');
  await expect(cortina).not.toHaveAttribute('hidden');
  await carrusel.getByRole('button', { name: 'Ver video 4' }).click();
  await expect(cortina).toHaveAttribute('hidden', '');
  await carrusel.getByRole('button', { name: 'Reproducir el video: Te cuento mis razones' }).click();
  await expect(carrusel.locator('[data-video-stage] iframe')).toHaveAttribute('src', /facebook\.com\/plugins\/video\.php/);
  // Mientras suena, el carrusel no avanza solo.
  await page.clock.runFor(20_000);
  await expect(carrusel.locator('[data-profile-image="3"]')).toBeVisible();
  await carrusel.getByRole('button', { name: 'Ver imagen 1' }).click();
  await expect(carrusel.locator('iframe')).toHaveCount(0);
  await expect(cortina).not.toHaveAttribute('hidden');
});

test('el carrusel de piezas admite hasta 4 imágenes y 4 videos', async ({ page }) => {
  await abrirEdicion(page);
  await page.getByRole('button', { name: 'Cambiar las imágenes y videos del carrusel de piezas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Carrusel de piezas' });
  await dialogo.locator('#piezas-nuevas').setInputFiles(await archivo('pieza.png', 1080, 1350));
  await expect(dialogo.locator('li')).toHaveCount(4);
  await expect(dialogo.locator('#piezas-nuevas')).toHaveCount(0);
  for (let i = 0; i < 4; i++) await dialogo.getByRole('button', { name: 'Añadir video' }).click();
  await expect(dialogo.locator('li')).toHaveCount(8);
  await expect(dialogo.getByRole('button', { name: 'Añadir video' })).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Revisa los campos marcados antes de guardar.' })).toBeVisible();
  await expect(dialogo.locator('#video-titulo-4')).toHaveAttribute('aria-invalid', 'true');
});
