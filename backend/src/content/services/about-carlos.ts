import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { MAX_ENTREVISTAS_VIDEO, MAX_VIDEOS_CARLOS, videosDePagina } from '../../contracts/acerca-de-carlos';
import { LARGOS } from '../../contracts/limites';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { ABOUT_CARLOS_PAGES, type AboutCarlosPage, type AboutCarlosSlug, type AboutCarlosPageStored, type VideoStored } from '../types';
import { existingPhotos, saved, type SaveRow } from '../guardado';
import { assertInsertable, cleanVideo } from '../videos';
import { photosById } from './media';
import { videoInsertable } from './video-cover';
import { plainText } from '../../validation/texto';

type AboutCarlosPageInput = AboutCarlosPageStored;

/** Indica si el slug es de una página «Acerca de Carlos». */
const isSlug = (slug: string): slug is AboutCarlosSlug => (ABOUT_CARLOS_PAGES as readonly string[]).includes(slug);
/** Texto plano validado, o null si llega vacío. */
const optional = (value: string | null | undefined, field: string, max: number, options?: { multiline?: boolean }) =>
  value?.trim() ? plainText(value, field, max, options) : null;

/** Un elemento cuya foto ya no existe se omite; una portada borrada deja el video sin portada. */
export async function listAboutCarlosPages(sql: SQL): Promise<Record<string, AboutCarlosPage>> {
  const rows = (await callPg<{ slug: string; contenido: AboutCarlosPageStored }>(sql, 'aboutCarlosList'))
    .map(({ slug, contenido }) => ({ slug, contenido, videos: videosDePagina<VideoStored>(contenido) }));
  const media = await photosById(sql, rows.flatMap(({ contenido: c, videos }) => [
    ...c.galeria.map(g => g.idMedio), ...videos.flatMap(v => (v.idPortada ? [v.idPortada] : [])),
  ]));
  const withPhoto = <T extends { idMedio: number }>(items: T[]) => items.flatMap(({ idMedio, ...rest }) => {
    const foto = media.get(idMedio);
    return foto ? [{ ...rest, foto }] : [];
  });
  return Object.fromEntries(rows.map(({ slug, contenido: c, videos }) => [slug, {
    videos: videos.map(v => ({
      titulo: v.titulo, descripcion: v.descripcion, enlace: v.enlace, vertical: v.vertical, medio: v.medio ?? null,
      portada: v.idPortada ? media.get(v.idPortada) ?? null : null,
    })),
    entrevista: c.entrevista,
    galeria: withPhoto(c.galeria),
  } satisfies AboutCarlosPage]));
}

/** Valida y limpia el contenido de una página «Acerca de Carlos» antes de guardarlo. */
function clean(slug: AboutCarlosSlug, input: AboutCarlosPageInput): AboutCarlosPageStored {
  if (slug !== 'conoce-mas' && (input.entrevista.length || input.galeria.length))
    throw new ApiError(422, 'Esta página solo tiene videos');
  const entrevistas = input.videos.filter(v => v.medio?.trim()).length;
  if (entrevistas && slug !== 'por-que-quiero-ser-alcalde') throw new ApiError(422, 'Esta página no tiene entrevistas');
  if (entrevistas > MAX_ENTREVISTAS_VIDEO) throw new ApiError(422, `Hasta ${MAX_ENTREVISTAS_VIDEO} entrevistas`);
  if (input.videos.length - entrevistas > MAX_VIDEOS_CARLOS) throw new ApiError(422, `Hasta ${MAX_VIDEOS_CARLOS} videos, sin contar las entrevistas`);
  return {
    videos: input.videos.map((v, i) => ({
      ...cleanVideo(v, `Video ${i + 1}`),
      descripcion: optional(v.descripcion, `Video ${i + 1} · texto breve`, LARGOS.acercaDeCarlos.descripcionVideo, { multiline: true }),
      medio: optional(v.medio, `Video ${i + 1} · medio`, LARGOS.acercaDeCarlos.medio),
    })),
    entrevista: input.entrevista.map((e, i) => ({
      pregunta: plainText(e.pregunta, `Pregunta ${i + 1}`, LARGOS.acercaDeCarlos.pregunta),
      respuesta: plainText(e.respuesta, `Pregunta ${i + 1} · respuesta`, LARGOS.acercaDeCarlos.respuesta, { multiline: true }),
    })),
    galeria: input.galeria.map((g, i) => ({
      idMedio: g.idMedio,
      alt: plainText(g.alt, `Foto ${i + 1} · descripción`, LARGOS.descripcionFoto),
      pie: plainText(g.pie, `Foto ${i + 1} · pie`, LARGOS.acercaDeCarlos.pie),
    })),
  };
}

/** Guarda las páginas «Por qué quiero ser alcalde» y «Conoce más», comprobando que cada video se pueda mostrar. */
export function createAboutCarlosPages(sql: SQL, authorization: Authorization, checkVideo = videoInsertable) {
  return {
    async save(access: string | undefined, slug: string, input: AboutCarlosPageInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!isSlug(slug)) throw new ApiError(404, 'No encontrado');
      const page = clean(slug, input);
      await assertInsertable(page.videos.map((v, i) => ({ enlace: v.enlace, campo: `Video ${i + 1}` })), checkVideo);
      await existingPhotos(sql, [...page.galeria.map(g => g.idMedio), ...page.videos.flatMap(v => (v.idPortada ? [v.idPortada] : []))]);
      return saved(await callPg<SaveRow>(sql, 'aboutCarlosSave', [actor.id_usuario, slug, page, version]));
    },
  };
}
