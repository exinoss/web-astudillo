import { expect, test } from '@playwright/test';
import { mockPanelApi, panelData } from './support/panel-api';

test('un visitante sin permiso no ve el panel ni el enlace en su cuenta', async ({ page }) => {
  const data = panelData('coadmin');
  data.profile.permisos = [];
  await mockPanelApi(page, data);
  await page.goto('/cuenta/');
  await expect(page.locator('#profile-panel')).toBeVisible();
  await expect(page.locator('#admin-panel-link')).toBeHidden();
  await page.goto('/cuenta/panel/');
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
  await expect(page.locator('#panel-pestanias')).toBeHidden();
});

test('un coadmin edita y publica, pero no ve Usuarios', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/');
  await page.locator('#admin-panel-link').click();
  await expect(page.getByRole('tab', { name: 'Propuestas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Usuarios' })).toBeHidden();
  await expect(page.locator('#panel-rol')).toHaveText('Coadmin');

  // Marcar un hito sube el avance al momento; guardar deja el cambio pendiente de publicar.
  await page.getByRole('tab', { name: 'Obras' }).click();
  await expect(page.locator('#seccion-obras')).toContainText('50 %');
  await page.getByLabel('Hito 2 completado').check();
  await expect(page.locator('#seccion-obras')).toContainText('100 %');
  await expect(page.locator('#seccion-obras')).toContainText('Terminada');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-publicar')).toContainText('Publicar cambios (1)');
  await page.locator('#panel-publicar').click();
  await expect(page.getByRole('tab', { name: 'Publicaciones' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#historial')).toContainText('Publicada');
  await expect(page.locator('#panel-publicar')).toBeDisabled();
});

test('un admin filtra, pagina y desactiva cuentas con confirmación', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#usuarios');
  const section = page.locator('#seccion-usuarios');
  await expect(section.locator('#usuarios-total')).toHaveText('23 cuentas');
  await section.getByRole('button', { name: 'Página 2' }).click();
  await expect(section.getByText('persona24@example.com').first()).toBeVisible();
  // Las cuentas protegidas solo muestran el motivo genérico.
  await section.locator('#usuarios-rol').selectOption('admin');
  await expect(section.getByText('No tienes permiso para modificar esta cuenta').first()).toBeVisible();
  await section.getByRole('button', { name: 'Limpiar filtros' }).click();
  await section.locator('#usuarios-buscar').fill('persona4@');
  await expect(section.locator('#usuarios-total')).toHaveText('1 cuenta');
  await section.getByRole('button', { name: 'Desactivar' }).first().click();
  await section.getByRole('button', { name: 'Sí, desactivar' }).first().click();
  await expect(page.locator('#panel-estado')).toContainText('Cuenta desactivada');
  expect(data.users.find(u => u.id === 4)!.estado).toBe('bloqueado');
});

test('el panel no se desborda de 320 px a escritorio', async ({ page }) => {
  await mockPanelApi(page, panelData('admin'));
  await page.goto('/cuenta/panel/');
  await expect(page.locator('#panel-pestanias')).toBeVisible();
  for (const tab of ['propuestas', 'biografia', 'obras', 'textos', 'publicaciones', 'usuarios'])
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/cuenta/panel/#${tab}`);
      await expect(page.locator(`#seccion-${tab}`)).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${tab} a ${width}px`).toBeLessThanOrEqual(1);
    }
});
