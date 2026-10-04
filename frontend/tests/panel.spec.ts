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
  for (const tab of ['propuestas', 'biografia', 'obras', 'textos', 'chat', 'participacion', 'publicaciones', 'usuarios'])
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/cuenta/panel/#${tab}`);
      await expect(page.locator(`#seccion-${tab}`)).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${tab} a ${width}px`).toBeLessThanOrEqual(1);
    }
});

const GRIS = 'rgb(213, 219, 227)';
const AZUL = 'rgb(6, 49, 118)';

test('Publicar y Guardar borrador solo se encienden cuando hay cambios', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#propuestas');
  const publicar = page.locator('#panel-publicar');
  await expect(publicar).toBeDisabled();
  await expect(publicar).toHaveCSS('background-color', GRIS);
  const guardar = page.locator('#seccion-propuestas').getByRole('button', { name: 'Guardar borrador' });
  await expect(guardar).toBeDisabled();
  await page.locator('#propuesta-nombre').fill('Agua potable para todos');
  await expect(guardar).toBeEnabled();
  await expect(guardar).toHaveCSS('background-color', AZUL);
  // Deshacer el cambio lo vuelve a apagar.
  await page.locator('#propuesta-nombre').fill('Agua potable');
  await expect(guardar).toBeDisabled();
  await page.locator('#propuesta-nombre').fill('Agua potable para todos');
  await guardar.click();
  await expect(page.locator('#panel-estado')).toContainText('guardado');
  await expect(publicar).toBeEnabled();
  await expect(publicar).toHaveCSS('background-color', AZUL);
  await expect(page.locator('#seccion-propuestas').getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
});

test('participación: el estado se cambia y un cambio ajeno no se pisa', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#participacion');
  const section = page.locator('#seccion-participacion');
  await expect(section).toContainText('Fuga de agua en la tubería principal.');
  await expect(section.getByRole('button', { name: 'Recibida (1)' })).toBeVisible();
  const guardar = section.getByRole('button', { name: 'Guardar' });
  await expect(guardar).toBeDisabled();
  await section.getByLabel('Estado', { exact: true }).selectOption('en_revision');
  await expect(guardar).toBeEnabled();
  // Otra persona la marcó como atendida mientras tanto: 409 y no se pisa.
  data.alertas[0].estado = 'atendida';
  await guardar.click();
  await expect(page.locator('#panel-estado')).toContainText('Otra persona cambió el estado');
  expect(data.alertas[0].estado).toBe('atendida');
  await page.reload();
  await section.getByLabel('Estado', { exact: true }).selectOption('recibida');
  await section.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('#panel-estado')).toContainText('Estado actualizado a «Recibida»');
  expect(data.alertas[0].estado).toBe('recibida');
});

test('redes sociales: WhatsApp se escribe como número y se guarda en formato internacional', async ({ page }) => {
  const data = panelData('admin');
  const facebook = data.draft.textos['enlace.facebook'];
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#textos');
  const form = page.locator('#redes-form');
  await expect(page.locator('#red-whatsapp')).toHaveValue('+593961368214');
  const guardar = form.getByRole('button', { name: 'Guardar borrador' });
  await expect(guardar).toBeDisabled();
  await page.locator('#red-whatsapp').fill('098 565 8595');
  await guardar.click();
  await expect(page.locator('#panel-estado')).toContainText('Enlaces guardados');
  expect(data.draft.textos['enlace.whatsapp']).toBe('593985658595');
  expect(data.draft.textos['enlace.facebook']).toBe(facebook);
  await expect(page.locator('#red-whatsapp')).toHaveValue('+593985658595');
});

test('chat: se añade una pregunta desde «sin respuesta» y se guarda', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#chat');
  const section = page.locator('#seccion-chat');
  const guardar = section.getByRole('button', { name: 'Guardar borrador' });
  await expect(guardar).toBeDisabled();
  await section.getByRole('button', { name: 'Crear respuesta' }).click();
  await expect(page.locator('#faq-pregunta-1')).toHaveValue('¿Cuándo hay caravana?');
  await page.locator('#faq-claves-1').fill('caravana, recorrido');
  await page.locator('#faq-respuesta-1').fill('La agenda se publica en Facebook cada semana.');
  await guardar.click();
  await expect(page.locator('#panel-estado')).toContainText('Preguntas del chat guardadas');
  expect(data.draft.chat).toHaveLength(2);
  expect(data.draft.chat[1]).toMatchObject({ pregunta: '¿Cuándo hay caravana?', palabrasClave: 'caravana, recorrido', destacada: false });
  await section.getByRole('button', { name: 'Descartar' }).click();
  await expect(section).toContainText('Por ahora el chat respondió todo');
});

test('obras: la foto subida se ve al momento y se guarda con su pie', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#obras');
  const section = page.locator('#seccion-obras');
  await expect(section.locator('img')).toHaveCount(1);
  await page.locator('#obra-fotos').setInputFiles('src/assets/carlos.jpg');
  await expect(page.locator('#panel-estado')).toContainText('Fotos subidas');
  await expect(section.locator('img')).toHaveCount(2);
  await expect.poll(() => section.locator('img').nth(1).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('#foto-pie-1').fill('Zanja abierta');
  await section.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('guardado');
  expect(data.draft.obras[0].fotos.map(f => [f.idMedio, f.pie])).toEqual([[2, 'Tubería instalada'], [90, 'Zanja abierta']]);
});

test('biografía: el año solo acepta cifras y Publicaciones es la última pestaña', async ({ page }) => {
  const data = panelData('admin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/panel/#biografia');
  const year = page.locator('#hito-anios');
  await expect(year).toHaveValue('1985');
  const tabs = await page.getByRole('tab').allTextContents();
  expect(tabs.slice(-2).map(t => t.trim())).toEqual(['Usuarios', 'Publicaciones']);
  await year.fill('');
  await year.pressSequentially('19xx9a5');
  await expect(year).toHaveValue('1995');
  await expect(page.locator('#hito-anios-lista option').first()).toHaveAttribute('value', String(new Date().getFullYear() + 1));
  await year.fill('');
  await page.locator('#seccion-biografia').getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('Elige el año');
});
