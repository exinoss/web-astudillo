import { expect, test, type Page } from '@playwright/test';

async function rellenarRegistro(page: Page) {
  await page.locator('#register-name').fill('María Pérez');
  await page.locator('#register-email').fill('maria@example.com');
  await page.locator('#register-password').fill('Ab1!xy');
  await page.locator('#register-confirm').fill('Ab1!xy');
}

test('el envío lento muestra el loader y lo retira al responder', async ({ page }) => {
  let responder!: () => void;
  await page.route('**/api/auth/register', route => new Promise<void>(ok => {
    responder = () => { route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"ok"}' }); ok(); };
  }));
  await page.goto('/cuenta/registro/');
  await rellenarRegistro(page);
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  const capa = page.locator('#register-form [role="status"]');
  await expect(capa).toContainText('Enviando…');
  await expect(capa.locator('svg')).toBeVisible();
  await expect(page.locator('#register-form')).toHaveAttribute('aria-busy', 'true');
  responder();
  await expect(capa).toHaveCount(0);
  await expect(page.locator('#account-status')).toContainText('recibirás un enlace');
});

test('una respuesta rápida no hace parpadear el loader', async ({ page }) => {
  await page.route('**/api/auth/register', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"ok"}' }));
  await page.goto('/cuenta/registro/');
  await rellenarRegistro(page);
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector('#register-form [role="status"]')) (window as any).loaderVisto = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#account-status')).toContainText('recibirás un enlace');
  expect(await page.evaluate(() => (window as any).loaderVisto)).toBeUndefined();
});

test('si el reproductor falla, el envío sigue y el siguiente intento lo recupera', async ({ page }) => {
  let fallar = true;
  // En desarrollo Vite sirve también el módulo `?url` que da la ruta: ese no se bloquea.
  await page.route('**/lottie_light*.js*', route =>
    fallar && !new URL(route.request().url()).searchParams.has('url') ? route.abort() : route.continue());
  // El segundo envío tarda más: da tiempo a que el reproductor recuperado pinte aunque la máquina vaya cargada.
  await page.route('**/api/auth/register', async route => {
    await new Promise(r => setTimeout(r, fallar ? 800 : 5000));
    await route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"Error de prueba"}' });
  });
  await page.goto('/cuenta/registro/');
  await rellenarRegistro(page);
  const boton = page.getByRole('button', { name: 'Enviar enlace de verificación' });
  const capa = page.locator('#register-form [role="status"]');
  await boton.click();
  await expect(capa).toContainText('Enviando…');
  await expect(page.locator('#account-status')).toBeVisible();
  await expect(capa).toHaveCount(0);
  fallar = false;
  await boton.click();
  await expect(capa.locator('svg')).toBeVisible();
});

/** Durante una navegación Playwright no consulta la página saliente: ella misma avisa. */
async function escucharTransicion(page: Page) {
  const avisos: string[] = [];
  await page.exposeFunction('avisarTransicion', (aviso: string) => avisos.push(aviso));
  await page.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const capa = document.querySelector<HTMLElement>('.transicion')!;
    new MutationObserver(() => {
      if (!capa.hidden)
        (window as any).avisarTransicion(`${location.pathname} svg=${!!capa.querySelector('svg')}`);
    }).observe(capa, { attributes: true, attributeFilter: ['hidden'] });
  }));
  return avisos;
}

test('la transición se ve una vuelta completa aunque la página llegue rápido', async ({ page }) => {
  const avisos = await escucharTransicion(page);
  await page.goto('/');
  await page.locator('a[href="#contenido"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  expect(avisos).toEqual([]);
  const inicio = Date.now();
  await page.locator('a.proposal-card[href="/propuestas/agua-potable/"]').first().click();
  await page.waitForURL('**/propuestas/agua-potable/');
  expect(avisos).toEqual(['/ svg=true']);
  // Una vuelta de la papeleta dura 56 fotogramas a 60 fps.
  expect(Date.now() - inicio).toBeGreaterThan(900);
  await expect(page.locator('.transicion')).toBeHidden();
});

test('con reducir movimiento se navega sin transición', async ({ page }) => {
  const avisos = await escucharTransicion(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).last().click();
  await page.getByRole('button', { name: 'Reducir movimiento' }).click();
  await page.locator('.access-toggle').click();
  await page.locator('a.proposal-card[href="/propuestas/agua-potable/"]').first().click();
  await page.waitForURL('**/propuestas/agua-potable/');
  expect(avisos).toEqual([]);
});

test('con reducir movimiento el loader queda quieto', async ({ page }) => {
  await page.route('**/api/auth/register', () => {});
  await page.goto('/cuenta/registro/');
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).last().click();
  await page.getByRole('button', { name: 'Reducir movimiento' }).click();
  await rellenarRegistro(page);
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  const svg = page.locator('#register-form [role="status"] svg');
  await expect(svg).toBeVisible();
  const antes = await svg.innerHTML();
  await page.waitForTimeout(400);
  expect(await svg.innerHTML()).toBe(antes);
});
