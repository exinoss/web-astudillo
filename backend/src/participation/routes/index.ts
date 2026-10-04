import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import { join } from 'node:path';
import type { Authorization } from '../../auth/types';
import { createLimiter } from '../../auth/services/limits';
import { createContent } from '../../content/services/content';
import { createChat } from '../services/chat';
import { ALERT_TYPES, createParticipation, STATES } from '../services/participation';

const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;
const literals = (values: readonly string[]) => t.Union(values.map(value => t.Literal(value)));
const text = (max: number) => t.String({ maxLength: max * 4 });
const strict = { additionalProperties: false };
// La genera el navegador al empezar el borrador; con ella un reenvío no duplica el registro.
const key = t.String({ format: 'uuid' });
const kind = t.Object({ tipo: literals(['alertas', 'sugerencias']) });
const PHOTO_FILE = /^(a[0-9a-f]{40})-(480|1280)\.webp$/;

export function participationRoutes(sql: SQL, authorization: Authorization, photoDir: string) {
  const limit = createLimiter();
  const participation = createParticipation(sql, authorization, limit, photoDir);
  const chat = createChat(sql, authorization, limit, createContent(sql, authorization));
  const admin = new Elysia({ prefix: '/api/admin/participacion', normalize: false })
    .get('/:tipo', ({ cookie, params, query }) =>
      participation.list(access(cookie), params.tipo, query.estado, query.pagina ?? 1), {
      params: kind,
      query: t.Object({ estado: t.Optional(literals(STATES)), pagina: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })) }, strict),
    })
    // `estadoAnterior`: lo que se veía en la lista; si ya no es así, otra persona lo cambió (409).
    .patch('/:tipo/:id/estado', ({ cookie, params, body }) =>
      participation.changeState(access(cookie), params.tipo, params.id, body.estado, body.estadoAnterior), {
      params: t.Object({ tipo: literals(['alertas', 'sugerencias']), id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ estado: literals(STATES), estadoAnterior: literals(STATES) }, strict),
    });
  const voter = new Elysia({ prefix: '/api/participacion', normalize: false })
    .post('/alertas', ({ cookie, body }) => participation.createAlert(access(cookie), body), {
      body: t.Object({
        idempotencia: key, tipo: literals(ALERT_TYPES), sector: text(120),
        referencia: t.Optional(text(180)), descripcion: text(1500), foto: t.Optional(t.File()),
      }, strict),
    })
    .get('/alertas/mias', ({ cookie }) => participation.myAlerts(access(cookie)))
    .post('/sugerencias', ({ cookie, body }) => participation.createSuggestion(access(cookie), body), {
      body: t.Object({ idempotencia: key, tema: t.String({ pattern: '^[a-z0-9-]{1,80}$' }), mensaje: text(1500) }, strict),
    })
    .get('/sugerencias/mias', ({ cookie }) => participation.mySuggestions(access(cookie)))
    .post('/chat', ({ cookie, body }) => chat.ask(access(cookie), body.mensaje, body.idempotencia), {
      body: t.Object({ mensaje: text(300), idempotencia: key }, strict),
    })
    // Fotos privadas de alertas: nginx no las sirve; aquí se comprueba quién las pide.
    .get('/fotos/:archivo', async ({ cookie, params, set }) => {
      const match = PHOTO_FILE.exec(params.archivo);
      if (!match) { set.status = 404; return { error: 'No encontrado' }; }
      await participation.photoAllowed(access(cookie), match[1]);
      const file = Bun.file(join(photoDir, params.archivo));
      if (!(await file.exists())) { set.status = 404; return { error: 'No encontrado' }; }
      return new Response(file, { headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=3600' } });
    }, { params: t.Object({ archivo: t.String({ maxLength: 80 }) }) });
  return new Elysia({ normalize: false }).use(voter).use(admin);
}
