import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import type { Config } from '../../config';
import { cookieOptions } from '../../http';
import { PREVIEW_SECONDS } from '../../security';
import type { Security } from '../../security/types';
import { createContent } from '../services/content';
import { createPreview } from '../services/preview';
import { access } from '.';

// Solo rutas del propio sitio: «//otro.sitio» o «/\otro.sitio» los navegadores los tratan como otro dominio.
const SITE_PATH = /^\/(?![\/\\])[^\s\\]*$/;

// `/api/vista-previa/*` va sin el prefijo admin: nginx las usa en las páginas, donde no llega la cookie de acceso.
export function previewRoutes(sql: SQL, config: Config, security: Security, authorization: Authorization) {
  const preview = createPreview(sql, authorization, security, createContent(sql, authorization));
  const pass = (cookie: Record<string, { value?: unknown }>) => cookie.vista_previa?.value as string | undefined;
  return new Elysia({ normalize: false })
    .post('/api/admin/vista-previa', ({ cookie }) => preview.request(access(cookie)))
    .get('/api/admin/vista-previa', ({ cookie }) => preview.state(access(cookie)))
    .post('/api/admin/vista-previa/entrar', async ({ cookie }) => {
      cookie.vista_previa.set({ value: await preview.pass(access(cookie)), ...cookieOptions(config, PREVIEW_SECONDS, '/') });
      return {};
    })
    .get('/api/vista-previa/acceso', async ({ cookie, set }) => {
      set.status = await preview.allowed(pass(cookie)) ? 204 : 401;
      set.headers['cache-control'] = 'no-store';
    })
    .get('/api/vista-previa/salir', ({ cookie, query, set }) => {
      cookie.vista_previa.set({ value: '', ...cookieOptions(config, 0, '/'), expires: new Date(0) });
      const path = query.ruta && SITE_PATH.test(query.ruta) ? query.ruta : '/cuenta/panel/';
      set.status = 303;
      set.headers.location = new URL(path, config.origin).toString();
      set.headers['cache-control'] = 'no-store';
    }, { query: t.Object({ ruta: t.Optional(t.String({ maxLength: 300 })) }, { additionalProperties: false }) });
}
