import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import { createContent } from '../services/content';
import { createMedia } from '../services/media';

const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;
const text = (max: number) => t.String({ maxLength: max * 4 });
const slug = t.Object({ slug: t.String({ pattern: '^[a-z0-9-]{1,80}$' }) });
const strict = { additionalProperties: false };

/** Rutas del contenido editable, las fotos y las publicaciones del panel. */
export function contentRoutes(sql: SQL, authorization: Authorization, mediaDir: string) {
  const content = createContent(sql, authorization);
  const media = createMedia(sql, authorization, mediaDir);
  return new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/contenido', ({ cookie }) => content.get(access(cookie)))
    .put('/contenido/textos/:clave', ({ cookie, params, body }) =>
      content.saveText(access(cookie), params.clave, body.valor), {
      params: t.Object({ clave: t.String({ maxLength: 120 }) }),
      body: t.Object({ valor: t.Union([text(1000), t.Null()]) }, strict),
    })
    .put('/contenido/propuestas/:slug', ({ cookie, params, body }) =>
      content.saveProposal(access(cookie), params.slug, body), {
      params: slug,
      body: t.Object({
        nombre: text(120), categoria: text(80), introduccion: text(400),
        kpis: t.Array(t.Object({ etiqueta: text(60), valor: text(30) }, strict), { maxItems: 6 }),
      }, strict),
    })
    .put('/contenido/biografia', ({ cookie, body }) => content.saveBiography(access(cookie), body.hitos), {
      body: t.Object({
        hitos: t.Array(t.Object({
          anios: text(40), titulo: text(120), texto: text(3000),
          idMedio: t.Union([t.Integer({ minimum: 1 }), t.Null()]), alt: t.Union([text(200), t.Null()]),
        }, strict), { maxItems: 30 }),
      }, strict),
    })
    .put('/contenido/obras/:slug', ({ cookie, params, body }) => content.saveWork(access(cookie), params.slug, body), {
      params: slug,
      body: t.Object({
        nota: text(600),
        hitos: t.Array(t.Object({ nombre: text(120), completado: t.Boolean() }, strict), { maxItems: 20 }),
        fotos: t.Array(t.Object({ idMedio: t.Integer({ minimum: 1 }), pie: text(200) }, strict), { maxItems: 24 }),
      }, strict),
    })
    .post('/medios', ({ cookie, body }) => media.upload(access(cookie), body.foto), {
      body: t.Object({ foto: t.File() }, strict),
    })
    .get('/publicaciones/pendientes', ({ cookie }) => content.pending(access(cookie)))
    .get('/publicaciones', ({ cookie, query }) => content.publications(access(cookie), query.pagina ?? 1), {
      query: t.Object({ pagina: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })) }, strict),
    })
    .post('/publicaciones', ({ cookie }) => content.publish(access(cookie)));
}
