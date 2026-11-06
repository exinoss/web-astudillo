import { test as base } from '@playwright/test';
import { PIXEL } from './fotos';

export * from '@playwright/test';

/** `test` con respuestas por defecto del sitio de pruebas: ninguna petición llega al backend local, que puede estar apagado o con otros datos. */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    // Las rutas de `page.route` de cada prueba tienen prioridad sobre estas.
    await context.route(`${baseURL}/api/**`, (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Inicia sesión"}' }));
    await context.route(`${baseURL}/medios/**`, (route) => route.fulfill({ contentType: 'image/png', body: PIXEL }));
    await use(context);
  },
});
