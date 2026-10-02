import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import { createContent } from '../services/content';
import { createMedia } from '../services/media';

const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;
const text = (max: number) => t.String({ maxLength: max * 4 });
const slug = t.Object({ slug: t.String({ pattern: '^[a-z0-9-]{1,80}$' }) });
const strict = { additionalProperties: false };
// Versión que el panel cargó (md5); con ella se detecta si otra persona guardó antes.
const version = t.String({ pattern: '^[a-f0-9]{32}$' });

export function contentRoutes(sql: SQL, authorization: Authorization, mediaDir: string) {
  const content = createContent(sql, authorization);
  const media = createMedia(sql, authorization, mediaDir);
  const admin = new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/contenido', ({ cookie }) => content.get(access(cookie)))
    .put('/contenido/textos/:clave', ({ cookie, params, body }) =>
      content.saveText(access(cookie), params.clave, body.valor, body.version), {
      params: t.Object({ clave: t.String({ maxLength: 120 }) }),
      // Un texto que nunca se cambió no tiene versión: se envía null.
      body: t.Object({ valor: t.Union([text(1000), t.Null()]), version: t.Union([version, t.Null()]) }, strict),
    })
    .put('/contenido/propuestas/:slug', ({ cookie, params, body }) =>
      content.saveProposal(access(cookie), params.slug, body, body.version), {
      params: slug,
      body: t.Object({
        nombre: text(120), categoria: text(80), introduccion: text(400),
        kpis: t.Array(t.Object({ etiqueta: text(60), valor: text(30) }, strict), { maxItems: 6 }),
        version,
      }, strict),
    })
    .put('/contenido/biografia', ({ cookie, body }) => content.saveBiography(access(cookie), body.hitos, body.version), {
      body: t.Object({
        hitos: t.Array(t.Object({
          anios: text(40), titulo: text(120), texto: text(3000),
          idMedio: t.Union([t.Integer({ minimum: 1 }), t.Null()]), alt: t.Union([text(200), t.Null()]),
        }, strict), { maxItems: 30 }),
        version,
      }, strict),
    })
    .put('/contenido/obras/:slug', ({ cookie, params, body }) =>
      content.saveWork(access(cookie), params.slug, body, body.version), {
      params: slug,
      body: t.Object({
        nota: text(600),
        hitos: t.Array(t.Object({ nombre: text(120), completado: t.Boolean() }, strict), { maxItems: 20 }),
        fotos: t.Array(t.Object({ idMedio: t.Integer({ minimum: 1 }), pie: text(200) }, strict), { maxItems: 24 }),
        version,
      }, strict),
    })
    .put('/contenido/chat', ({ cookie, body }) => content.saveChat(access(cookie), body.respuestas, body.version), {
      body: t.Object({
        respuestas: t.Array(t.Object({
          pregunta: text(160), palabrasClave: text(300), respuesta: text(1000),
          enlaceTexto: t.Union([text(60), t.Null()]), enlaceRuta: t.Union([text(200), t.Null()]), destacada: t.Boolean(),
        }, strict), { maxItems: 60 }),
        version,
      }, strict),
    })
    .get('/chat/sin-respuesta', ({ cookie }) => content.unanswered(access(cookie)))
    .delete('/chat/sin-respuesta/:clave', ({ cookie, params }) => content.discardUnanswered(access(cookie), params.clave), {
      params: t.Object({ clave: t.String({ maxLength: 300 }) }),
    })
    .post('/medios', ({ cookie, body }) => media.upload(access(cookie), body.foto), {
      body: t.Object({ foto: t.File() }, strict),
    })
    .get('/publicaciones/pendientes', ({ cookie }) => content.pending(access(cookie)))
    .get('/publicaciones', ({ cookie, query }) => content.publications(access(cookie), query.pagina ?? 1), {
      query: t.Object({ pagina: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })) }, strict),
    })
    .post('/publicaciones', ({ cookie }) => content.publish(access(cookie)));
  // Lectura pública del contenido publicado: la usa el frontend al compilar y en desarrollo.
  return new Elysia({ normalize: false })
    .get('/api/contenido/publicado', () => content.current())
    .use(admin);
}
