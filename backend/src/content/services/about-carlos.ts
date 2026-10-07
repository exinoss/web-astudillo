import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { videoLinkProblem, videoSource } from '../../contracts/video';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { ABOUT_CARLOS_PAGES, type AboutCarlosPage, type AboutCarlosSlug, type AboutCarlosPageStored, type Photo } from '../types';
import { CONTENT_CONFLICT } from './content';
import { ensureCardVariant, toPhoto } from './media';
import { plainText } from './validation';

type MediaRow = { id_medio: number; nombre: string; ancho: number; alto: number; anchos: number[] };
type SaveRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; version: string | null };

export type AboutCarlosPageInput = AboutCarlosPageStored;

const isSlug = (slug: string): slug is AboutCarlosSlug => (ABOUT_CARLOS_PAGES as readonly string[]).includes(slug);
const optional = (value: string | null | undefined, field: string, max: number) =>
  value?.trim() ? plainText(value, field, max) : null;

async function photos(sql: SQL, ids: number[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<number, Photo>();
  const rows = await callPg<MediaRow>(sql, 'mediaDetails', [unique.join(',')]);
  return new Map(rows.map(row => [row.id_medio, toPhoto(row)]));
}

/** Un elemento cuya foto ya no existe se omite. */
export async function listAboutCarlosPages(sql: SQL): Promise<Record<string, AboutCarlosPage>> {
  const rows = await callPg<{ slug: string; contenido: AboutCarlosPageStored }>(sql, 'aboutCarlosList');
  const media = await photos(sql, rows.flatMap(({ contenido: c }) => [
    ...c.tarjetas.map(t => t.idMedio), ...c.galeria.map(g => g.idMedio),
    ...(c.retrato ? [c.retrato.idMedio] : []), ...(c.video?.idPortada ? [c.video.idPortada] : []),
  ]));
  const withPhoto = <T extends { idMedio: number }>(items: T[]) => items.flatMap(({ idMedio, ...rest }) => {
    const foto = media.get(idMedio);
    return foto ? [{ ...rest, foto }] : [];
  });
  return Object.fromEntries(rows.map(({ slug, contenido: c }) => {
    const retrato = c.retrato && media.get(c.retrato.idMedio);
    const video = c.video && {
      titulo: c.video.titulo, descripcion: c.video.descripcion, enlace: c.video.enlace, vertical: c.video.vertical,
      portada: c.video.idPortada ? media.get(c.video.idPortada) ?? null : null,
    };
    return [slug, {
      tarjetas: withPhoto(c.tarjetas),
      video,
      retrato: retrato ? { foto: retrato, alt: c.retrato!.alt } : null,
      entrevista: c.entrevista,
      galeria: withPhoto(c.galeria),
    } satisfies AboutCarlosPage];
  }));
}

function clean(slug: AboutCarlosSlug, input: AboutCarlosPageInput): AboutCarlosPageStored {
  const personal = slug === 'conoce-mas';
  if (!personal && (input.retrato || input.entrevista.length || input.galeria.length))
    throw new ApiError(422, 'Esta página solo tiene tarjetas y video');
  let video: AboutCarlosPageStored['video'] = null;
  if (input.video) {
    const source = videoSource(input.video.enlace);
    if (!source) throw new ApiError(422, `Video: ${videoLinkProblem(input.video.enlace)}`);
    video = {
      titulo: plainText(input.video.titulo, 'Video · título', 80),
      descripcion: optional(input.video.descripcion, 'Video · texto breve', 200),
      enlace: source.url, vertical: input.video.vertical, idPortada: input.video.idPortada,
    };
  }
  return {
    tarjetas: input.tarjetas.map((t, i) => ({
      idMedio: t.idMedio,
      alt: plainText(t.alt, `Tarjeta ${i + 1} · descripción de la foto`, 200),
      titulo: plainText(t.titulo, `Tarjeta ${i + 1} · título`, 60),
      texto: plainText(t.texto, `Tarjeta ${i + 1} · texto`, 180),
      color: t.color, enfoque: { x: t.enfoque.x, y: t.enfoque.y },
    })),
    video,
    retrato: input.retrato ? { idMedio: input.retrato.idMedio, alt: plainText(input.retrato.alt, 'Retrato · descripción', 200) } : null,
    entrevista: input.entrevista.map((e, i) => ({
      pregunta: plainText(e.pregunta, `Pregunta ${i + 1}`, 160),
      respuesta: plainText(e.respuesta, `Pregunta ${i + 1} · respuesta`, 1000, { multiline: true }),
    })),
    galeria: input.galeria.map((g, i) => ({
      idMedio: g.idMedio,
      alt: plainText(g.alt, `Foto ${i + 1} · descripción`, 200),
      pie: plainText(g.pie, `Foto ${i + 1} · pie`, 200),
    })),
  };
}

export function createAboutCarlosPages(sql: SQL, authorization: Authorization, mediaDir: string) {
  return {
    async save(access: string | undefined, slug: string, input: AboutCarlosPageInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!isSlug(slug)) throw new ApiError(404, 'No encontrado');
      const page = clean(slug, input);
      const ids = [...page.tarjetas.map(t => t.idMedio), ...page.galeria.map(g => g.idMedio),
        ...(page.retrato ? [page.retrato.idMedio] : []), ...(page.video?.idPortada ? [page.video.idPortada] : [])];
      const media = await photos(sql, ids);
      if (ids.some(id => !media.has(id))) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
      // Antes de guardar: una tarjeta publicada nunca apunta a una variante que falta.
      await Promise.all(page.tarjetas.map(t => ensureCardVariant(mediaDir, media.get(t.idMedio)!)));
      const [row] = await callPg<SaveRow>(sql, 'aboutCarlosSave', [actor.id_usuario, slug, page, version]);
      if (!row) throw new ApiError(404, 'No encontrado');
      if (row.resultado === 'conflicto') throw new ApiError(409, CONTENT_CONFLICT);
      return { version: row.version };
    },
  };
}
