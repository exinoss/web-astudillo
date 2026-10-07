import { expect, test } from '@playwright/test';
import { mockPanelApi, panelData } from './support/panel-api';

test('la vista previa espera a que el borrador esté listo y abre la página pedida', async ({ page }) => {
  const data = panelData('coadmin');
  await mockPanelApi(page, data);
  await page.goto('/cuenta/vista-previa/?ruta=%2Facerca-de-nosotros%2Fconoce-mas%2F');
  await expect(page.locator('#account-status')).toHaveText('Preparando la vista previa…');
  await page.waitForURL('**/acerca-de-nosotros/conoce-mas/');
  expect(data.preview).toMatchObject({ requests: 1, entered: true });
});

test('solo abre rutas del propio sitio', async ({ page }) => {
  const data = panelData('coadmin');
  data.preview.states = ['lista'];
  await mockPanelApi(page, data);
  await page.goto('/cuenta/vista-previa/?ruta=%2F%2Fotro.sitio%2F');
  await page.waitForURL(url => url.pathname === '/' && url.host === new URL(page.url()).host);
  expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL!).origin);
});

test('si la vista previa falla se puede reintentar, y sin permiso no se ofrece', async ({ page }) => {
  const data = panelData('coadmin');
  data.preview.states = ['fallida'];
  await mockPanelApi(page, data);
  await page.goto('/cuenta/vista-previa/?ruta=%2Fciudadania%2Fchat%2F');
  await expect(page.locator('#account-status')).toHaveText('No se pudo preparar la vista previa. Inténtalo de nuevo.');
  data.preview.states = ['lista'];
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await page.waitForURL('**/ciudadania/chat/');
  expect(data.preview.requests).toBe(2);

  await page.route('**/api/admin/vista-previa', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Permiso insuficiente"}' }));
  await page.goto('/cuenta/vista-previa/?ruta=%2F');
  await expect(page.locator('#account-status')).toHaveText('No tienes permiso para ver esta página.');
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeHidden();
});

test('cada pestaña abre la vista previa de su página, siempre en la misma pestaña', async ({ page, context }) => {
  const data = panelData('coadmin');
  data.pending = [{ tipo: 'Texto', descripcion: 'pie.lema' }];
  await mockPanelApi(page, data);
  await page.context().route('**/cuenta/vista-previa/**', route => route.fulfill({ contentType: 'text/html', body: '<p>vista previa</p>' }));
  let preview;
  for (const [tab, ruta] of [['biografia', '/acerca-de-nosotros/biografia/'], ['obras', '/ciudadania/obras-en-ejecucion/'],
    ['chat', '/ciudadania/chat/'], ['propuestas', '/propuestas/agua-potable/']]) {
    await page.goto(`/cuenta/panel/#${tab}`);
    const button = page.locator(`#seccion-${tab}`).getByRole('button', { name: 'Vista previa del borrador' });
    const opened = context.waitForEvent('page', { timeout: 2000 }).catch(() => null);
    await button.click();
    preview = (await opened) ?? preview;
    await preview!.waitForURL(`**/cuenta/vista-previa/?ruta=${encodeURIComponent(ruta)}`);
  }
  expect(context.pages()).toHaveLength(2);
});

test('sin cambios por publicar, la vista previa no se ofrece hasta que se guarda algo', async ({ page }) => {
  await mockPanelApi(page, panelData('coadmin'));
  await page.goto('/cuenta/panel/#propuestas');
  const section = page.locator('#seccion-propuestas');
  const button = section.getByRole('button', { name: 'Vista previa del borrador' });
  await expect(button).toBeDisabled();
  await section.getByLabel('Nombre', { exact: true }).fill('Agua potable para todos');
  await section.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('#panel-estado')).toContainText('guardad');
  await expect(button).toBeEnabled();
});
