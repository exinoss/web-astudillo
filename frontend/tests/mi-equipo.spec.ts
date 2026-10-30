import { expect, test, type Page } from '@playwright/test';
import { servirFotos } from './support/fotos';
import { mockPanelApi, panelData } from './support/panel-api';

test.beforeEach(({ page }) => servirFotos(page));

const abrirParroquias = async (page: Page, ...nombres: string[]) => {
  await page.getByRole('heading', { name: 'Parroquias' }).click();
  for (const nombre of nombres) await page.getByText(nombre, { exact: true }).click();
};

test('el menú y la portada llevan a «Mi equipo», con el equipo en tres columnas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Acerca de mí' })).toHaveAttribute('href', '/acerca-de-nosotros/');
  await page.getByRole('link', { name: 'Conoce a mi equipo' }).click();
  await page.waitForURL('**/mi-equipo/');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Mi equipo' })).toHaveAttribute('aria-current', 'page');
  const personas = page.getByRole('list', { name: 'Integrantes del equipo' }).getByRole('listitem');
  await expect(personas).toHaveCount(9);
  const fila = await personas.evaluateAll(items => items.slice(0, 4).map(li => Math.round(li.getBoundingClientRect().top)));
  expect(fila.slice(0, 3).every(top => top === fila[0])).toBeTruthy();
  expect(fila[3]).toBeGreaterThan(fila[0]);
  await expect(personas.nth(0).getByRole('img', { name: 'Foto de Persona de prueba 1' })).toBeVisible();
  await expect(personas.nth(1).locator('svg[aria-hidden="true"]')).toBeVisible();
  await expect(personas.nth(1)).toHaveText('Persona de prueba 2');
  await expect(personas.nth(2)).toContainText('Concejal de prueba');
});

test('en celular el equipo va en dos columnas con la última centrada, y ninguna página desborda', async ({ page }) => {
  await page.goto('/mi-equipo/');
  for (const ancho of [320, 390, 480, 481, 768, 1440]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    const cajas = await page.getByRole('list', { name: 'Integrantes del equipo' }).getByRole('listitem')
      .evaluateAll(items => items.map(li => li.getBoundingClientRect()).map(r => ({ top: Math.round(r.top), centro: r.left + r.width / 2 })));
    const columnas = cajas.filter(c => c.top === cajas[0].top).length;
    expect(columnas, `${ancho}px`).toBe(ancho <= 480 ? 2 : 3);
    if (ancho <= 480) expect(Math.abs(cajas[8].centro - ancho / 2)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${ancho}px`).toBeTruthy();
  }
});

test('cada parroquia muestra su texto y sus fotos, o su aviso si no tiene fotos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/mi-equipo/');
  await expect(page.getByText('Alto Tambo', { exact: true })).toBeHidden();
  await abrirParroquias(page, 'Alto Tambo', 'Ancón (Pichangal)', 'Calderón', 'Carondelet');
  await expect(page.locator('main details details')).toHaveCount(12);
  const conTexto = page.getByRole('region', { name: 'Fotos de Alto Tambo' });
  const sinTexto = page.getByRole('region', { name: 'Fotos de Calderón' });
  await expect(page.getByText('Segundo párrafo de prueba.')).toBeVisible();
  const [texto, fotos] = await Promise.all([page.getByText('Párrafo de prueba.', { exact: true }), conTexto].map(l => l.evaluate(el => el.getBoundingClientRect())));
  expect(fotos.left).toBeGreaterThan(texto.right);
  expect((await sinTexto.boundingBox())!.width).toBeGreaterThan((await conTexto.boundingBox())!.width * 1.6);
  await expect(page.getByText('Texto de prueba sin fotos.')).toBeVisible();
  await expect(page.locator('p:visible').filter({ hasText: 'Aún no hay fotos de esta parroquia.' })).toHaveCount(2);
  await expect(page.getByText('Aún no hay fotos de esta parroquia.')).toHaveCount(10);
  // Ninguna foto se dibuja más grande que su archivo (1600 px en las de prueba).
  const anchos = await page.locator('[data-diapositiva]:not([hidden]) img').evaluateAll(imgs => imgs.map(img => img.getBoundingClientRect().width));
  expect(anchos.every(ancho => ancho > 0 && ancho <= 1600)).toBeTruthy();
});

test('el carrusel de una parroquia avanza solo, se para con el puntero y con «Reducir movimiento»', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/mi-equipo/');
  await abrirParroquias(page, 'Calderón');
  const carrusel = page.getByRole('region', { name: 'Fotos de Calderón' });
  const posicion = carrusel.locator('[data-posicion]');
  await page.mouse.move(0, 0);
  await expect(posicion).toHaveText('1 / 3');
  await page.clock.runFor(5100);
  await expect(posicion).toHaveText('2 / 3');
  // Lo que avanza solo no se anuncia al lector de pantalla; lo que pide la persona, sí.
  await expect(posicion).toHaveAttribute('aria-live', 'off');
  await carrusel.hover();
  await page.clock.runFor(10_200);
  await expect(posicion).toHaveText('2 / 3');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  await page.clock.runFor(10_200);
  await expect(posicion).toHaveText('2 / 3');
  await carrusel.getByRole('button', { name: 'Foto siguiente' }).click();
  await expect(posicion).toHaveText('3 / 3');
  await expect(posicion).toHaveAttribute('aria-live', 'polite');
});

test('al pulsar una foto se abre en grande en esa misma foto y al cerrar vuelve el foco', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mi-equipo/');
  await abrirParroquias(page, 'Alto Tambo');
  const carrusel = page.getByRole('region', { name: 'Fotos de Alto Tambo' });
  await carrusel.getByRole('button', { name: 'Foto siguiente' }).click();
  const foto = carrusel.getByRole('button', { name: 'Ampliar: Foto de prueba 2' });
  await foto.click();
  const visor = page.getByRole('dialog', { name: 'Fotos de Alto Tambo' });
  await expect(visor).toBeVisible();
  await expect(visor.locator('[data-visor-contador]')).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(visor.locator('[data-visor-contador]')).toHaveText('3 / 3');
  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
  await expect(foto).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('el panel edita el equipo: añade a alguien sin foto, exige el nombre y guarda con la versión cargada', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/cuenta/panel/#mi-equipo');
  const guardar = page.getByRole('button', { name: 'Guardar borrador' });
  await expect(page.getByLabel('Nombre').first()).toHaveValue('Rosa Valencia');
  await expect(guardar).toBeDisabled();
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await expect(page.locator('#persona-nombre-2')).toBeFocused();
  await guardar.click();
  await expect(page.locator('#panel-estado')).toHaveText('Escribe el nombre de cada persona.');
  await page.locator('#persona-nombre-2').fill('Marta Angulo');
  await page.locator('#persona-quien-2').fill('Concejala urbana');
  await page.getByRole('button', { name: 'Subir persona 3' }).click();
  await guardar.click();
  await expect(page.locator('#panel-estado')).toContainText('Borrador del equipo guardado');
  expect(data.savedTeam.at(-1)).toEqual({ clave: 'equipo', personas: [
    { idMedio: 4, nombre: 'Rosa Valencia', quien: 'Concejala rural' },
    { idMedio: null, nombre: 'Marta Angulo', quien: 'Concejala urbana' },
    { idMedio: null, nombre: 'Luis Cortez', quien: '' },
  ] });
});

test('el panel edita una parroquia nunca guardada con versión nula y exige describir cada foto', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cuenta/panel/#mi-equipo');
  await page.getByRole('button', { name: 'Parroquias', exact: true }).click();
  await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('Agua para los recintos.');
  await page.getByLabel('Parroquia', { exact: true }).selectOption({ label: 'Calderón' });
  await expect(page.getByText('Esta parroquia todavía no tiene fotos.')).toBeVisible();
  await page.getByLabel('Texto', { exact: true }).fill('Caminos lastrados.\n\nAgua segura.');
  await page.locator('#parroquia-fotos').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('foto') });
  await expect(page.getByLabel('Descripción de la foto')).toHaveValue('');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toHaveText('Describe cada foto antes de guardar.');
  await page.getByLabel('Descripción de la foto').fill('Recorrido por el río');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('Borrador de «Calderón» guardado');
  expect(data.savedTeam.at(-1)).toEqual({ clave: 'calderon', texto: 'Caminos lastrados.\n\nAgua segura.', fotos: [{ idMedio: 90, alt: 'Recorrido por el río' }] });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
