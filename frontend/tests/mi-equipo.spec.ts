import { expect, test, type Page } from './support/prueba';
import { mockPanelApi, panelData } from './support/panel-api';


const abrirParroquias = async (page: Page, ...nombres: string[]) => {
  await page.getByRole('heading', { name: 'Parroquias' }).click();
  for (const nombre of nombres) await page.getByText(nombre, { exact: true }).click();
};

const cajas = (page: Page, grupo: string) => page.getByRole('region', { name: grupo }).getByRole('listitem')
  .evaluateAll(items => items.map(li => li.getBoundingClientRect()).map(r => ({ top: Math.round(r.top), left: Math.round(r.left), centro: r.left + r.width / 2 })));

test('el menú y la portada llevan a «Mi equipo», con una franja por grupo y cada principal sobre su suplente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Acerca de mí' })).toHaveAttribute('href', '/acerca-de-nosotros/');
  await page.getByRole('link', { name: 'Conoce a mi equipo' }).click();
  await page.waitForURL('**/mi-equipo/');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Mi equipo' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveText(['Prefecto', 'Concejales urbanos', 'Concejales rurales', 'Parroquias']);
  const urbanos = page.getByRole('region', { name: 'Concejales urbanos' }).getByRole('listitem');
  await expect(urbanos).toHaveText([
    'Persona de prueba 21er CONCEJAL URBANO', 'Persona de prueba 31er CONCEJAL SUPLENTE', 'Persona de prueba 42do CONCEJAL URBANO',
    'Persona de prueba 52do CONCEJAL SUPLENTE', 'Persona de prueba 63er CONCEJAL URBANO', 'Persona de prueba 73er CONCEJAL SUPLENTE',
  ]);
  // Principales en la primera fila y cada suplente debajo del suyo.
  const [u1, s1, u2, s2, u3, s3] = await cajas(page, 'Concejales urbanos');
  expect([u2.top, u3.top]).toEqual([u1.top, u1.top]);
  expect([s1.top, s2.top, s3.top].every(top => top > u1.top)).toBeTruthy();
  expect([s1.left, s2.left, s3.left]).toEqual([u1.left, u2.left, u3.left]);
  await expect(urbanos.nth(2).getByRole('img', { name: 'Foto de Persona de prueba 4' })).toBeVisible();
  await expect(urbanos.nth(0).locator('svg[aria-hidden="true"]')).toBeVisible();
  // Los rurales usan dos columnas del mismo ancho, centradas.
  const rurales = await cajas(page, 'Concejales rurales');
  expect(rurales).toHaveLength(4);
  expect(Math.abs((rurales[0].centro + rurales[2].centro) / 2 - 720)).toBeLessThan(10);
});

test('en celular cada principal va junto a su suplente, en dos columnas, y ninguna página desborda', async ({ page }) => {
  await page.goto('/mi-equipo/');
  for (const ancho of [320, 390, 480, 481, 760, 768, 1100, 1440]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    const [u1, s1, u2] = await cajas(page, 'Concejales urbanos');
    if (ancho <= 480) {
      expect(s1.top, `${ancho}px`).toBe(u1.top);
      expect(u2.top, `${ancho}px`).toBeGreaterThan(u1.top);
    } else expect(u2.top, `${ancho}px`).toBe(u1.top);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${ancho}px`).toBeTruthy();
  }
});

test('la tarjeta del prefecto abre su información al lado en escritorio y debajo en celular, también con el teclado', async ({ page }) => {
  for (const ancho of [1440, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/mi-equipo/');
    const tarjeta = page.getByRole('button', { name: /Persona de prueba 1/ });
    const info = page.getByRole('region', { name: 'Sobre Persona de prueba 1' });
    await expect(tarjeta).toHaveAttribute('aria-expanded', 'false');
    await expect(info).toBeHidden();
    // Cerrada, la tarjeta queda centrada.
    const cerrada = (await tarjeta.boundingBox())!;
    expect(Math.abs(cerrada.x + cerrada.width / 2 - ancho / 2), `${ancho}px`).toBeLessThan(10);
    await tarjeta.focus();
    await page.keyboard.press('Enter');
    await expect(tarjeta).toHaveAttribute('aria-expanded', 'true');
    await expect(info).toBeVisible();
    await expect(info).toContainText('Presentación de prueba del prefecto.');
    await expect(info.getByRole('listitem')).toHaveText(['Primer punto de prueba', 'Segundo punto de prueba']);
    await expect.poll(async () => {
      const [t, i] = await Promise.all([tarjeta.boundingBox(), info.boundingBox()]);
      return ancho > 760 ? i!.x > t!.x + t!.width : i!.y > t!.y + t!.height - 1;
    }, `${ancho}px`).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${ancho}px`).toBeTruthy();
    await info.getByRole('button', { name: 'Cerrar la información del prefecto' }).click();
    await expect(info).toBeHidden();
    await expect(tarjeta).toBeFocused();
    await expect(tarjeta).toHaveAttribute('aria-expanded', 'false');
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

test('el panel edita el equipo: el tipo da el primer puesto libre, exige tipo y nombre y guarda con la versión cargada', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/cuenta/panel/#mi-equipo');
  const guardar = page.getByRole('button', { name: 'Guardar borrador' });
  await expect(page.getByLabel('Nombre').first()).toHaveValue('Rosa Valencia');
  await expect(guardar).toBeDisabled();

  // Una tarjeta nueva empieza sin tipo y no se guarda hasta elegirlo.
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await expect(page.locator('#persona-tipo-2')).toBeFocused();
  await guardar.click();
  await expect(page.locator('#panel-estado')).toHaveText('Elige el tipo de cada persona.');
  await expect(page.locator('#persona-tipo-2')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Elige el tipo.', { exact: true })).toBeVisible();
  // El 1er concejal urbano ya está: le toca el 2do. La tarjeta no cambia de lugar mientras se edita.
  await page.locator('#persona-tipo-2').selectOption('urbanos');
  await expect(page.locator('#persona-tipo-2')).toBeFocused();
  await expect(page.locator('#persona-puesto-2')).toHaveValue('urbano-2');
  await expect(page.locator('#persona-puesto-2 option[value="urbano-1"]')).toBeDisabled();
  await page.locator('#persona-puesto-2').selectOption('urbano-suplente-1');
  await expect(page.locator('#persona-puesto-2')).toBeFocused();
  await guardar.click();
  await expect(page.locator('#panel-estado')).toHaveText('Escribe el nombre de cada persona.');
  await expect(page.locator('#persona-nombre-2')).toBeFocused();
  await page.locator('#persona-nombre-2').fill('Marta Angulo');

  // Rurales: el 1ro ya está, el siguiente recibe el 2do y el que sigue, el 1er suplente; ninguna tarjeta se mueve.
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await page.locator('#persona-tipo-3').selectOption('rurales');
  await expect(page.locator('#persona-puesto-3')).toHaveValue('rural-2');
  await page.locator('#persona-nombre-3').fill('Pedro Quiñónez');
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await page.locator('#persona-tipo-4').selectOption('rurales');
  await expect(page.locator('#persona-tipo-4')).toBeFocused();
  await expect(page.locator('#persona-puesto-4')).toHaveValue('rural-suplente-1');
  await expect(page.locator('#persona-nombre-3')).toHaveValue('Pedro Quiñónez');
  await page.locator('#persona-nombre-4').fill('Ana Bone');

  // El prefecto, con su presentación, su trayectoria por puntos y la vista previa.
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await page.locator('#persona-tipo-5').selectOption('prefecto');
  await expect(page.locator('#persona-tipo-5')).toHaveValue('prefecto');
  await page.locator('#persona-nombre-5').fill('Javier Buitrón');
  await page.getByLabel('Presentación').fill('Trabaja con las comunidades.');
  await page.getByRole('button', { name: 'Añadir un punto' }).click();
  await expect(page.getByRole('textbox', { name: 'Punto 1 de la trayectoria' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Punto 1 de la trayectoria' }).fill('Director provincial');
  await page.getByRole('button', { name: 'Añadir un punto' }).click();
  await page.getByRole('textbox', { name: 'Punto 2 de la trayectoria' }).fill('Punto que sobra');
  await page.getByRole('button', { name: 'Añadir un punto' }).click();
  await page.getByRole('textbox', { name: 'Punto 3 de la trayectoria' }).fill('Presidente de la asociación');
  await page.getByRole('button', { name: 'Quitar el punto 2 de la trayectoria' }).click();
  const vista = page.locator('[data-vista-prefecto]');
  await expect(vista).toContainText('Trabaja con las comunidades.');
  await expect(vista.getByRole('listitem')).toHaveText(['Director provincial', 'Presidente de la asociación']);
  // Una palabra muy larga se parte dentro de la vista previa en vez de ensancharla.
  await page.getByLabel('Presentación').fill('d'.repeat(300));
  const [caja, tarjetaPrefecto] = await Promise.all([vista.boundingBox(), page.locator('#equipo-form > ol > li').filter({ has: vista }).boundingBox()]);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(tarjetaPrefecto!.x + tarjetaPrefecto!.width);
  expect(await vista.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
  await page.getByLabel('Presentación').fill('Trabaja con las comunidades.');
  // Ya hay prefecto: otra tarjeta no puede elegirlo.
  await page.getByRole('button', { name: 'Añadir a alguien' }).click();
  await expect(page.locator('#persona-tipo-6 option[value="prefecto"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Quitar a esta persona' }).click();

  await guardar.click();
  await expect(page.locator('[data-notificacion]')).toContainText('Guardado como borrador');
  const sinExtras = { presentacion: '', trayectoria: [] };
  // Se envían en el orden en que se crearon; el backend las guarda en el de los puestos.
  expect(data.savedTeam.at(-1)).toEqual({ clave: 'equipo', personas: [
    { idMedio: 4, puesto: 'urbano-1', nombre: 'Rosa Valencia', ...sinExtras },
    { idMedio: null, puesto: 'rural-1', nombre: 'Luis Cortez', ...sinExtras },
    { idMedio: null, puesto: 'urbano-suplente-1', nombre: 'Marta Angulo', ...sinExtras },
    { idMedio: null, puesto: 'rural-2', nombre: 'Pedro Quiñónez', ...sinExtras },
    { idMedio: null, puesto: 'rural-suplente-1', nombre: 'Ana Bone', ...sinExtras },
    { idMedio: null, puesto: 'prefecto', nombre: 'Javier Buitrón', presentacion: 'Trabaja con las comunidades.', trayectoria: ['Director provincial', 'Presidente de la asociación'] },
  ] });
  expect(data.savedTeam).toHaveLength(1);
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
  await expect(page.locator('[data-notificacion]')).toContainText('Guardado como borrador');
  expect(data.savedTeam.at(-1)).toEqual({ clave: 'calderon', texto: 'Caminos lastrados.\n\nAgua segura.', fotos: [{ idMedio: 90, alt: 'Recorrido por el río' }] });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
