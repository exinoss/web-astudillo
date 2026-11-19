import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import { join } from 'node:path';
import { ipOf } from '../../auth/routes/common';
import type { Authorization, Confirmation } from '../../auth/types';
import { createLimiter } from '../../auth/services/limits';
import { createContent } from '../../content/services/content';
import { createChat } from '../services/chat';
import { createParticipation } from '../services/participation';
import { ESTADOS_PARTICIPACION, LARGOS_PARTICIPACION as LARGOS, TIPOS_DE_ALERTA } from '../../contracts/participacion';
import { access } from '../../http';
import { confirmacion, literals, pagina, slugText, strict, text } from '../../validation/esquemas';

// La genera el navegador al empezar el borrador; con ella un reenvío no duplica el registro.
const key = t.String({ format: 'uuid' });
const kinds = literals(['alertas', 'sugerencias']);
const kind = t.Object({ tipo: kinds });
const item = t.Object({ tipo: kinds, id: t.Numeric({ minimum: 1 }) });
const visibility = t.Object({ publica: t.Optional(t.Boolean()), anonima: t.Boolean() }, strict);
const PHOTO_FILE = /^(a[0-9a-f]{40})-(480|1280)\.webp$/;

/** Rutas de envío, historial, listas públicas y revisión de alertas y sugerencias. */
export function participationRoutes(sql: SQL, authorization: Authorization, confirmation: Confirmation, photoDir: string, trustProxyIp: boolean) {
  const limit = createLimiter();
  const participation = createParticipation(sql, authorization, limit, photoDir, confirmation);
  const chat = createChat(sql, authorization, limit, createContent(sql, authorization));
  const admin = new Elysia({ prefix: '/api/admin/participacion', normalize: false })
    .get('/:tipo', ({ cookie, params, query }) =>
      participation.list(access(cookie), params.tipo, query.estado, query.pagina ?? 1), {
      params: kind,
      query: t.Object({ estado: t.Optional(literals(ESTADOS_PARTICIPACION)), pagina }, strict),
    })
    // `estadoAnterior`: lo que se veía en la lista; si ya no es así, otra persona lo cambió (409).
    .patch('/:tipo/:id/estado', ({ cookie, params, body }) =>
      participation.changeState(access(cookie), params.tipo, params.id, body.estado, body.estadoAnterior), {
      params: item,
      body: t.Object({ estado: literals(ESTADOS_PARTICIPACION), estadoAnterior: literals(ESTADOS_PARTICIPACION) }, strict),
    })
    // `anterior`: la visibilidad que se veía en la lista; `publica` solo existe en las alertas.
    .patch('/:tipo/:id/visibilidad', ({ cookie, params, body }) =>
      participation.changeVisibility(access(cookie), params.tipo, params.id, body, body.anterior), {
      params: item,
      body: t.Object({ publica: t.Optional(t.Boolean()), anonima: t.Boolean(), anterior: visibility }, strict),
    })
    .delete('/:tipo/:id', ({ cookie, params, body, server, request }) =>
      participation.remove(access(cookie), params.tipo, params.id, body.confirmacion, ipOf(server, request, trustProxyIp)), {
      params: item,
      body: t.Object({ confirmacion }, strict),
    });
  const voter = new Elysia({ prefix: '/api/participacion', normalize: false })
    .post('/alertas', ({ cookie, body }) => participation.createAlert(access(cookie), body), {
      body: t.Object({
        idempotencia: key, tipo: literals(TIPOS_DE_ALERTA), sector: text(LARGOS.sector),
        referencia: t.Optional(text(LARGOS.referencia)), descripcion: text(LARGOS.descripcion), foto: t.Optional(t.File()),
      }, strict),
    })
    .get('/alertas/mias', ({ cookie }) => participation.myAlerts(access(cookie)))
    .get('/publicas/:tipo', ({ cookie, params, query }) => participation.publicList(access(cookie), params.tipo, query.pagina ?? 1), {
      params: kind, query: t.Object({ pagina }, strict),
    })
    .post('/sugerencias', ({ cookie, body }) => participation.createSuggestion(access(cookie), body), {
      body: t.Object({ idempotencia: key, tema: slugText, mensaje: text(LARGOS.mensaje) }, strict),
    })
    .get('/sugerencias/mias', ({ cookie }) => participation.mySuggestions(access(cookie)))
    .post('/chat', ({ cookie, body }) => chat.ask(access(cookie), body.mensaje, body.idempotencia), {
      body: t.Object({ mensaje: text(LARGOS.consulta), idempotencia: key }, strict),
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
