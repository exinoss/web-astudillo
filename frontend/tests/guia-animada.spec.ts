import { expect, test, type Page } from './support/prueba';

const caja = (page: Page) => page.locator('[data-guia-caja]');
const texto = (page: Page) => page.locator('[data-guia-texto]');


/** Abre la página con la guía a punto de seguir en el paso `i` (como tras pulsar un enlace de la guía). */
async function seguirEn(page: Page, ruta: string, i: number) {
  await page.addInitScript((paso) => { if (!sessionStorage.getItem('prueba-hecha')) { sessionStorage.setItem('guia-paso', String(paso)); sessionStorage.setItem('prueba-hecha', '1'); } }, i);
  await page.goto(ruta);
}

test('la invitación aparece en la primera visita y no vuelve tras «No, gracias»', async ({ page }) => {
  await page.goto('/');
  const invitacion = page.locator('[data-guia-invitacion]');
  await expect(invitacion).toBeVisible({ timeout: 8000 });
  await expect(invitacion).toContainText('¿Te enseño a usar la página?');
  await invitacion.getByRole('button', { name: 'No, gracias' }).click();
  await expect(invitacion).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ver la guía de la página' })).toBeFocused();
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(invitacion).toBeHidden();
});

test('si el navegador bloquea el saludo, suena en el primer toque y no con «No, gracias»', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    (window as any).sonaron = [];
    let tocado = false;
    for (const nombre of ['pointerup', 'keydown']) addEventListener(nombre, () => (tocado = true), true);
    HTMLMediaElement.prototype.play = function () {
      if (!tocado) return Promise.reject(new DOMException('bloqueado', 'NotAllowedError'));
      (window as any).sonaron.push(this.src);
      return play.call(this);
    };
  });
  await page.goto('/');
  const invitacion = page.locator('[data-guia-invitacion]');
  await expect(invitacion).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).sonaron)).toHaveLength(0);
  await invitacion.locator('p').click();
  await expect.poll(() => page.evaluate(() => (window as any).sonaron.join())).toContain('00-guia');

  await page.evaluate(() => localStorage.removeItem('guia-vista'));
  await page.reload();
  await expect(invitacion).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);
  await invitacion.getByRole('button', { name: 'No, gracias' }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).sonaron)).toHaveLength(0);
});

test('la guía se pausa, se silencia y se salta, y el foco vuelve al botón que la abrió', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('guia-vista', '1'));
  await page.goto('/');
  const abrir = page.getByRole('button', { name: 'Ver la guía de la página' });
  await abrir.click();
  await expect(texto(page)).toContainText('¡Hola! Soy Carlos Astudillo');
  await expect(page.locator('.foco')).toHaveCount(1);
  await caja(page).getByRole('button', { name: 'Pausar la guía' }).click();
  await expect(caja(page).getByRole('button', { name: 'Reanudar la guía' })).toBeVisible();
  const voz = caja(page).getByRole('button', { name: 'Silenciar a Carlos' });
  await voz.click();
  await expect(caja(page).getByRole('button', { name: 'Activar la voz de Carlos' })).toHaveAttribute('aria-pressed', 'true');
  await caja(page).getByRole('button', { name: 'Saltar guía' }).click();
  await expect(caja(page)).toBeHidden();
  await expect(page.locator('.foco, .cursor-fantasma')).toHaveCount(0);
  await expect(abrir).toBeFocused();
});

test('Escape cierra la guía', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('guia-vista', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver la guía de la página' }).click();
  await expect(texto(page)).toContainText('¡Hola!');
  await page.keyboard.press('Escape');
  await expect(caja(page)).toBeHidden();
});

test('si el navegador bloquea el audio al cambiar de página, la guía pide «Continuar»', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('bloqueado', 'NotAllowedError'));
  });
  await seguirEn(page, '/cuenta/', 10);
  await expect(caja(page).getByRole('button', { name: 'Continuar' })).toBeVisible({ timeout: 8000 });
  await expect(caja(page).getByRole('button', { name: 'Saltar guía' })).toBeVisible();
  await expect(caja(page).getByRole('button', { name: 'Pausar la guía' })).toBeHidden();
});

test('en el acceso, el foco pasa por el correo, la contraseña y Google aunque su botón no haya cargado', async ({ page }) => {
  await page.route('**/accounts.google.com/**', (route) => route.abort());
  await seguirEn(page, '/cuenta/', 10);
  const continuar = caja(page).getByRole('button', { name: 'Continuar' });
  await page.waitForFunction(() => !document.querySelector<HTMLElement>('[data-guia-continuar]')?.hidden || !!document.querySelector('[data-guia-texto]')?.textContent?.startsWith('Aquí entras'));
  if (await continuar.isVisible()) await continuar.click();
  const encierra = (sel: string) => page.waitForFunction((s) => {
    const f = document.querySelector('.foco')?.getBoundingClientRect();
    const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length)?.getBoundingClientRect();
    return !!f && !!e && Math.abs(f.left + 8 - e.left) < 3 && Math.abs(f.top + 8 - e.top) < 3 && Math.abs(f.width - 16 - e.width) < 3;
  }, sel, { timeout: 12000 });
  await encierra('#login-correo');
  await encierra('#login-contrasenia');
  await encierra('#google-login-button > *, #google-login-button:empty, #google-login-unavailable');
});

test('con la sesión iniciada se saltan los pasos de crear la cuenta', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 1, correo: 'maria@example.com', rol: 'votante', nombresCompletos: 'María', direccion: '', tieneContrasenia: true, tieneGoogle: false, permisos: [],
  }) }));
  await page.addInitScript(() => localStorage.setItem('astudillo:sesion', '1'));
  await seguirEn(page, '/ciudadania/sugerencias/', 9);
  await expect(texto(page)).toContainText('¡Gracias por acompañarme!', { timeout: 8000 });
});

test('un paso cuyo elemento no está en la página se salta', async ({ page }) => {
  await page.addInitScript(() => addEventListener('DOMContentLoaded', () => document.querySelector('#contacto')?.remove()));
  await seguirEn(page, '/', 5);
  await expect(texto(page)).toContainText('En «Tu voz cuenta»', { timeout: 8000 });
});

test('si el personaje no se descarga, la guía ofrece reintentar', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('guia-vista', '1'));
  await page.route('**/_astro/runtime.*.js*', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver la guía de la página' }).click();
  await expect(texto(page)).toHaveText('No se pudo cargar la guía.');
  await page.unroute('**/_astro/runtime.*.js*');
  await caja(page).getByRole('button', { name: 'Reintentar' }).click();
  await expect(texto(page)).toContainText('¡Hola! Soy Carlos Astudillo');
});

test('con «Reducir movimiento» no aparece el cursor fantasma', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('guia-vista', '1'));
  await page.goto('/');
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  await page.getByRole('button', { name: 'Ver la guía de la página' }).click();
  await expect(texto(page)).toContainText('¡Hola!');
  await expect(page.locator('.foco')).toHaveCount(1);
  await expect(page.locator('.cursor-fantasma')).toHaveCount(0);
});

test('el panel de accesibilidad queda cerrado al pasar el paso que lo abre', async ({ page }) => {
  await seguirEn(page, '/', 4);
  const panel = page.locator('#access-panel');
  const continuar = caja(page).getByRole('button', { name: 'Continuar' });
  await page.waitForFunction(() => !document.querySelector<HTMLElement>('[data-guia-continuar]')?.hidden || !document.querySelector<HTMLElement>('#access-panel')?.hidden);
  if (await continuar.isVisible()) await continuar.click();
  await expect(panel).toBeVisible({ timeout: 8000 });
  await expect(texto(page)).toContainText('escríbeme por WhatsApp', { timeout: 15000 });
  await expect(page.locator('#access-panel')).toBeHidden();
});

test('«Avance de obras» de la portada lleva a su página', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#propuestas').getByRole('link', { name: /Avance de obras/ })).toHaveAttribute('href', '/ciudadania/obras-en-ejecucion/');
});

test('el correo que muestra la guía es el de confirmación', async ({ request }) => {
  const respuesta = await request.get('/guia/correo-confirmacion.html');
  expect(respuesta.ok()).toBe(true);
  const html = await respuesta.text();
  expect(html).toContain('Confirmar mi correo');
  expect(html).toContain('noindex');
});
