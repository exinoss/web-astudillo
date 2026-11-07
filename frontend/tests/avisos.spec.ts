import { expect, test, type Page } from './support/prueba';
import { mockPanelApi, panelData } from './support/panel-api';
import { avisoNoInsertable } from '../../backend/src/contracts/video';
import type { Aviso } from '../../backend/src/contracts/avisos';

const REEL = 'https://www.facebook.com/reel/4119395378341161/';
const VIDEO: Aviso = {
  clave: 'video:por-que-quiero-ser-alcalde', tipo: 'error', icono: 'alert', cantidad: 1,
  ruta: '/cuenta/panel/?aviso=video%3Apor-que-quiero-ser-alcalde#acerca-de-carlos',
  texto: 'El video de «Por qué quiero ser alcalde» ya no se puede ver en el sitio.', accion: 'Cambiar el video',
  detalle: avisoNoInsertable('facebook', 'bloqueado'), valor: REEL,
};
const SUGERENCIAS: Aviso = {
  clave: 'sugerencias:en_revision', tipo: 'pendiente', icono: 'bulb', cantidad: 10,
  ruta: '/cuenta/panel/?aviso=sugerencias%3Aen_revision#participacion', texto: '10 sugerencias en revisión', accion: 'Verlas',
};

/** Administrador con un video publicado que ya no se ve y diez sugerencias en revisión. */
async function conAvisos(page: Page, avisos = [VIDEO, SUGERENCIAS]) {
  const data = panelData('admin');
  data.draft.acercaDeCarlos['por-que-quiero-ser-alcalde'].video = { titulo: 'Carlos en el barrio', descripcion: null, enlace: REEL, vertical: true, portada: null };
  data.avisos = avisos;
  await mockPanelApi(page, data);
  return data;
}

const notificacion = (page: Page) => page.locator('[data-notificacion]');
const campana = (page: Page) => page.locator('#avisos-campana');

test('un visitante no ve la campana ni descarga su script', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => scripts.push(r.url()));
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(campana(page)).toBeHidden();
  expect(scripts.filter((u) => u.includes('avisos'))).toEqual([]);
});

test('al entrar, la notificación muestra los errores una sola vez; la campana suma todo lo pendiente', async ({ page }) => {
  await conAvisos(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(campana(page)).toHaveAccessibleName('Avisos: 11');
  await expect(campana(page).locator('[data-avisos-numero]')).toHaveText('11');
  await expect(notificacion(page)).toContainText('Tienes 1 aviso');
  await expect(notificacion(page)).toContainText(VIDEO.texto);
  await expect(notificacion(page).getByRole('link', { name: 'Cambiar el video' })).toHaveAttribute('href', VIDEO.ruta);

  // Al navegar ya no vuelve a salir; los avisos siguen en la campana.
  await page.goto('/mi-equipo/');
  await expect(campana(page)).toBeVisible();
  await page.waitForTimeout(800);
  await expect(notificacion(page)).toHaveCount(0);

  await campana(page).click();
  const lista = page.getByRole('region', { name: 'Avisos' });
  await expect(lista.getByRole('link')).toHaveText([/ya no se puede ver en el sitio\.\s*Cambiar el video/, /10 sugerencias en revisión\s*Verlas/]);
  await expect(campana(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(lista).toBeHidden();
  await expect(campana(page)).toBeFocused();
});

test('sin errores no sale la notificación; al volver a iniciar sesión sale otra vez', async ({ page }) => {
  const data = await conAvisos(page, [SUGERENCIAS]);
  await page.goto('/');
  await expect(campana(page)).toHaveAccessibleName('Avisos: 10');
  await page.waitForTimeout(800);
  await expect(notificacion(page)).toHaveCount(0);

  // Ya contada como vista en esta sesión, un error nuevo no la saca hasta que se cierra sesión y se vuelve a entrar.
  data.avisos = [VIDEO, SUGERENCIAS];
  await page.goto('/mi-equipo/');
  await expect(campana(page)).toHaveAccessibleName('Avisos: 11');
  await page.waitForTimeout(800);
  await expect(notificacion(page)).toHaveCount(0);
  await page.route('**/api/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Inicia sesión"}' }));
  await page.goto('/');
  await expect(campana(page)).toBeHidden();
  await page.unroute('**/api/me');
  await page.goto('/');
  await expect(notificacion(page)).toContainText('Tienes 1 aviso');
});

test('en celular la lista se ancla a la campana, sin pasar del borde de la pantalla', async ({ page }) => {
  await conAvisos(page, [VIDEO, ...Array.from({ length: 6 }, (_, i) => ({ ...SUGERENCIAS, clave: `s${i}` }))]);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await notificacion(page).getByRole('button', { name: 'Cerrar aviso' }).click();
  await campana(page).click();
  const lista = page.getByRole('region', { name: 'Avisos' });
  const caja = (await lista.boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(12);
  expect(caja.x + caja.width).toBeLessThanOrEqual(308);
  expect(caja.y + caja.height).toBeLessThanOrEqual(568);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('entrar desde el aviso del video abre su sección marcada en rojo, con el foco en el enlace', async ({ page }) => {
  await conAvisos(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(VIDEO.ruta);
  await expect(page.locator('#video-enlace')).toBeFocused();
  await expect(page.locator('#video-enlace')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#video-detectado')).toHaveText(VIDEO.detalle!);
  await expect(page.locator('[data-acerca-seccion="video"]')).toHaveAccessibleName('Video, tiene un aviso');
  await expect(page.locator('#pestania-acerca-de-carlos')).toHaveAttribute('data-aviso', '');
  await expect(page.locator('#acerca-pagina option:checked')).toHaveText('Por qué quiero ser alcalde · Revisar el video');
  expect(new URL(page.url()).search).toBe('');
  // En el panel no sale la notificación: ahí están las marcas.
  await expect(notificacion(page)).toHaveCount(0);

  // Con otro enlace el campo vuelve a la normalidad.
  await page.locator('#video-enlace').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await expect(page.locator('#video-enlace')).not.toHaveAttribute('aria-invalid', 'true');
});

test('entrar desde un aviso agrupado abre Participación con su filtro, y revisar actualiza la campana', async ({ page }) => {
  const nuevas: Aviso = { ...SUGERENCIAS, clave: 'alertas:recibida', icono: 'location', cantidad: 1, ruta: '/cuenta/panel/?aviso=alertas%3Arecibida#participacion', texto: '1 alerta ciudadana nueva', accion: 'Revisarla' };
  const data = await conAvisos(page, [nuevas]);
  await page.goto(nuevas.ruta);
  await expect(page.locator('[data-tipo="alertas"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-filtro="recibida"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(campana(page)).toHaveAccessibleName('Avisos: 1');
  data.avisos = [];
  await page.locator('#estado-7').selectOption('en_revision');
  await page.locator('[data-estado-de="7"] button').click();
  await expect(page.getByRole('status').filter({ hasText: 'Estado actualizado a «En revisión»' })).toBeVisible();
  await expect(campana(page)).toHaveAccessibleName('Avisos: ninguno');

  await page.goto(SUGERENCIAS.ruta);
  await expect(page.locator('[data-tipo="sugerencias"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-filtro="en_revision"]')).toHaveAttribute('aria-pressed', 'true');
});

test('al terminar la publicación sale la notificación: la de éxito se cierra sola, salvo con el mouse encima', async ({ page }) => {
  const data = await conAvisos(page, []);
  data.pending = [{ tipo: 'Texto', descripcion: 'pie.lema' }];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/cuenta/panel/#textos');
  await page.locator('#panel-publicar').click();
  await expect(page.locator('#panel-estado')).toContainText('Publicación en cola');
  const exito = notificacion(page);
  await expect(exito).toContainText('Sitio publicado');
  await exito.hover();
  await page.waitForTimeout(3500);
  await expect(exito).toBeVisible();
  await page.mouse.move(10, 10);
  await expect(exito).toHaveCount(0, { timeout: 4000 });
});

test('si la publicación falla, la notificación lo dice y ofrece ver las publicaciones', async ({ page }) => {
  const data = await conAvisos(page, []);
  data.pending = [{ tipo: 'Texto', descripcion: 'pie.lema' }];
  data.publishResult = 'fallida';
  await page.goto('/cuenta/panel/#textos');
  await page.locator('#panel-publicar').click();
  const fallida = notificacion(page);
  await expect(fallida).toHaveAttribute('role', 'alert');
  await expect(fallida).toContainText('No se pudo publicar');
  await expect(fallida.getByRole('link', { name: 'Ver publicaciones' })).toHaveAttribute('href', '/cuenta/panel/#publicaciones');
});
