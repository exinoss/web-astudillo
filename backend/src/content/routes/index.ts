import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import { MAX_PRESENTACION, MAX_PUNTO_TRAYECTORIA, MAX_TRAYECTORIA, PUESTOS } from '../../contracts/equipo';
import { MAX_BANNERS, MAX_FOTOS_EQUIPO, MAX_PIEZAS, ORIGINALES } from '../../contracts/inicio';
import { MAX_FOTOS_PARROQUIA } from '../../contracts/parroquias';
import { LARGOS } from '../../contracts/limites';
import { VIDEO_URL_MAX } from '../../contracts/video';
import { createAboutCarlosPages } from '../services/about-carlos';
import { createContent } from '../services/content';
import { createHomeCarousels } from '../services/home-carousels';
import { createMedia } from '../services/media';
import { createMyTeam } from '../services/my-team';

export const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;
const text = (max: number) => t.String({ maxLength: max * 4 });
const slug = t.Object({ slug: t.String({ pattern: '^[a-z0-9-]{1,80}$' }) });
const strict = { additionalProperties: false };
// Versión que el panel cargó (md5); con ella se detecta si otra persona guardó antes.
const version = t.String({ pattern: '^[a-f0-9]{32}$' });
const mediaId = t.Integer({ minimum: 1 });
const percent = t.Integer({ minimum: 0, maximum: 100 });
const homeImage = t.Union([t.Object({ original: t.Union(ORIGINALES.map(o => t.Literal(o))) }, strict), t.Object({ idMedio: mediaId }, strict)]);

export function contentRoutes(sql: SQL, authorization: Authorization, mediaDir: string) {
  const content = createContent(sql, authorization);
  const media = createMedia(sql, authorization, mediaDir);
  const aboutCarlosPages = createAboutCarlosPages(sql, authorization, mediaDir);
  const myTeam = createMyTeam(sql, authorization);
  const homeCarousels = createHomeCarousels(sql, authorization);
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
        nombre: text(LARGOS.propuesta.nombre), categoria: text(LARGOS.propuesta.categoria), introduccion: text(LARGOS.propuesta.introduccion),
        kpis: t.Array(t.Object({ etiqueta: text(LARGOS.propuesta.etiquetaCifra), valor: text(LARGOS.propuesta.valorCifra) }, strict), { maxItems: 6 }),
        version,
      }, strict),
    })
    .put('/contenido/biografia', ({ cookie, body }) => content.saveBiography(access(cookie), body.hitos, body.version), {
      body: t.Object({
        hitos: t.Array(t.Object({
          anios: text(40), titulo: text(LARGOS.biografia.titulo), texto: text(LARGOS.biografia.texto),
          idMedio: t.Union([t.Integer({ minimum: 1 }), t.Null()]), alt: t.Union([text(LARGOS.descripcionFoto), t.Null()]),
        }, strict), { maxItems: 30 }),
        version,
      }, strict),
    })
    .put('/contenido/obras/:slug', ({ cookie, params, body }) =>
      content.saveWork(access(cookie), params.slug, body, body.version), {
      params: slug,
      body: t.Object({
        nota: text(LARGOS.obra.nota),
        hitos: t.Array(t.Object({ nombre: text(LARGOS.obra.hito), completado: t.Boolean() }, strict), { maxItems: 20 }),
        fotos: t.Array(t.Object({ idMedio: t.Integer({ minimum: 1 }), pie: text(LARGOS.obra.pie) }, strict), { maxItems: 24 }),
        version,
      }, strict),
    })
    .put('/contenido/chat', ({ cookie, body }) => content.saveChat(access(cookie), body.respuestas, body.version), {
      body: t.Object({
        respuestas: t.Array(t.Object({
          pregunta: text(LARGOS.chat.pregunta), palabrasClave: text(LARGOS.chat.palabrasClave), respuesta: text(LARGOS.chat.respuesta),
          enlaceTexto: t.Union([text(LARGOS.chat.textoEnlace), t.Null()]), enlaceRuta: t.Union([text(LARGOS.chat.rutaEnlace), t.Null()]), destacada: t.Boolean(),
        }, strict), { maxItems: 60 }),
        version,
      }, strict),
    })
    .put('/contenido/acerca-de-carlos/:slug', ({ cookie, params, body }) =>
      aboutCarlosPages.save(access(cookie), params.slug, body, body.version), {
      params: slug,
      body: t.Object({
        tarjetas: t.Array(t.Object({
          idMedio: mediaId, alt: text(LARGOS.descripcionFoto), titulo: text(LARGOS.acercaDeCarlos.tituloTarjeta), texto: text(LARGOS.acercaDeCarlos.textoTarjeta),
          color: t.Union([t.Literal('rojo'), t.Literal('azul')]), enfoque: t.Object({ x: percent, y: percent }, strict),
        }, strict), { maxItems: 6 }),
        video: t.Union([t.Object({
          titulo: text(LARGOS.acercaDeCarlos.tituloVideo), descripcion: t.Union([text(LARGOS.acercaDeCarlos.descripcionVideo), t.Null()]), enlace: t.String({ maxLength: VIDEO_URL_MAX }),
          vertical: t.Boolean(), idPortada: t.Union([mediaId, t.Null()]),
        }, strict), t.Null()]),
        retrato: t.Union([t.Object({ idMedio: mediaId, alt: text(LARGOS.descripcionFoto) }, strict), t.Null()]),
        entrevista: t.Array(t.Object({ pregunta: text(LARGOS.acercaDeCarlos.pregunta), respuesta: text(LARGOS.acercaDeCarlos.respuesta) }, strict), { maxItems: 6 }),
        galeria: t.Array(t.Object({ idMedio: mediaId, alt: text(LARGOS.descripcionFoto), pie: text(LARGOS.acercaDeCarlos.pie) }, strict), { maxItems: 6 }),
        version,
      }, strict),
    })
    // Una parte que nunca se guardó no tiene versión: se envía null.
    .put('/contenido/mi-equipo/equipo', ({ cookie, body }) => myTeam.saveTeam(access(cookie), body, body.version), {
      body: t.Object({
        personas: t.Array(t.Object({
          idMedio: t.Union([mediaId, t.Null()]),
          puesto: t.Union(PUESTOS.map(p => t.Literal(p.clave))),
          nombre: text(LARGOS.equipo.nombre),
          presentacion: text(MAX_PRESENTACION),
          trayectoria: t.Array(text(MAX_PUNTO_TRAYECTORIA), { maxItems: MAX_TRAYECTORIA }),
        }, strict), { maxItems: PUESTOS.length }),
        version: t.Union([version, t.Null()]),
      }, strict),
    })
    .put('/contenido/mi-equipo/parroquias/:slug', ({ cookie, params, body }) =>
      myTeam.saveParish(access(cookie), params.slug, body, body.version), {
      params: slug,
      body: t.Object({
        texto: text(LARGOS.equipo.textoParroquia),
        fotos: t.Array(t.Object({ idMedio: mediaId, alt: text(LARGOS.descripcionFoto) }, strict), { maxItems: MAX_FOTOS_PARROQUIA }),
        version: t.Union([version, t.Null()]),
      }, strict),
    })
    .put('/contenido/inicio/principal', ({ cookie, body }) => homeCarousels.saveMain(access(cookie), body, body.version), {
      body: t.Object({
        banners: t.Array(t.Object({ imagen: homeImage, celular: t.Union([mediaId, t.Null()]), alt: text(LARGOS.descripcionFoto) }, strict), { minItems: 1, maxItems: MAX_BANNERS }),
        retrato: t.Object({ imagen: homeImage, alt: text(LARGOS.descripcionFoto) }, strict),
        version: t.Union([version, t.Null()]),
      }, strict),
    })
    .put('/contenido/inicio/piezas', ({ cookie, body }) => homeCarousels.savePieces(access(cookie), body, body.version), {
      body: t.Object({
        piezas: t.Array(t.Object({ imagen: homeImage, alt: text(LARGOS.descripcionFoto) }, strict), { minItems: 1, maxItems: MAX_PIEZAS }),
        version: t.Union([version, t.Null()]),
      }, strict),
    })
    // Puede quedar vacío: sin fotos, la portada no muestra este carrusel.
    .put('/contenido/inicio/equipo', ({ cookie, body }) => homeCarousels.saveTeamPhotos(access(cookie), body, body.version), {
      body: t.Object({
        fotos: t.Array(t.Object({ idMedio: mediaId, alt: text(LARGOS.descripcionFoto) }, strict), { maxItems: MAX_FOTOS_EQUIPO }),
        version: t.Union([version, t.Null()]),
      }, strict),
    })
    .get('/chat/sin-respuesta', ({ cookie }) => content.unanswered(access(cookie)))
    .delete('/chat/sin-respuesta/:clave', ({ cookie, params }) => content.discardUnanswered(access(cookie), params.clave), {
      params: t.Object({ clave: t.String({ maxLength: 300 }) }),
    })
    .post('/medios', ({ cookie, body }) => media.upload(access(cookie), body.foto), {
      body: t.Object({ foto: t.File() }, strict),
    })
    .post('/medios/portada-video', ({ cookie, body }) => media.videoCover(access(cookie), body.enlace), {
      body: t.Object({ enlace: t.String({ minLength: 1, maxLength: VIDEO_URL_MAX }) }, strict),
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
