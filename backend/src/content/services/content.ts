import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import type { BiographyItem, ChatAnswer, ContentVersions, Kpi, ProposalContent, Snapshot, WorkContent } from '../types';
import { listAboutCarlosPages } from './about-carlos';
import { toPhoto } from './media';
import { linkValue, plainText, sitePath, year } from './validation';

export const PUBLICATIONS_PAGE_SIZE = 10;
/** Otra persona guardó antes: no se sobrescribe su trabajo. */
export const CONTENT_CONFLICT = 'Otra persona guardó cambios en este contenido mientras editabas. Recarga para ver su versión; lo tuyo no se guardó.';
const KEY = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

type ProposalRow = { slug: string; nombre: string; categoria: string; introduccion: string; kpis: Kpi[] };
type BiographyRow = {
  anios: string; titulo: string; texto: string; alt: string | null; id_medio: number | null;
  medio_nombre: string | null; medio_ancho: number | null; medio_alto: number | null; medio_anchos: number[] | null;
};
type WorkRow = {
  slug: string; nota: string; actualizado_en: string; hitos: WorkContent['hitos'];
  fotos: (Omit<WorkContent['fotos'][number], 'idMedio'> & { idMedio: number })[];
};

type ChatRow = {
  pregunta: string; palabras_clave: string; respuesta: string;
  enlace_texto: string | null; enlace_ruta: string | null; destacada: boolean;
};

export interface ProposalInput { nombre: string; categoria: string; introduccion: string; kpis: Kpi[] }
export interface BiographyInput { anios: string; titulo: string; texto: string; idMedio: number | null; alt: string | null }
export interface WorkInput {
  nota: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: { idMedio: number; pie: string }[];
}

export function createContent(sql: SQL, authorization: Authorization) {
  /** Lee el borrador actual completo, con la misma forma que se congela al publicar. */
  async function snapshot(): Promise<Snapshot> {
    const [texts, proposals, biography, works, chat, acercaDeCarlos] = await Promise.all([
      callPg<{ clave: string; valor: string }>(sql, 'textsList'),
      callPg<ProposalRow>(sql, 'proposalsList'),
      callPg<BiographyRow>(sql, 'biographyList'),
      callPg<WorkRow>(sql, 'worksList'),
      callPg<ChatRow>(sql, 'chatList'),
      listAboutCarlosPages(sql),
    ]);
    return {
      version: 1,
      textos: Object.fromEntries(texts.map(t => [t.clave, t.valor])),
      propuestas: proposals.map(({ slug, nombre, categoria, introduccion, kpis }) =>
        ({ slug, nombre, categoria, introduccion, kpis })),
      biografia: biography.map((h): BiographyItem => ({
        anios: h.anios, titulo: h.titulo, texto: h.texto, alt: h.alt,
        foto: h.id_medio === null ? null : toPhoto({
          id_medio: h.id_medio, nombre: h.medio_nombre!, ancho: h.medio_ancho!, alto: h.medio_alto!, anchos: h.medio_anchos!,
        }),
      })),
      obras: works.map(w => ({
        slug: w.slug, nota: w.nota, actualizadoEn: new Date(w.actualizado_en).toISOString(),
        hitos: w.hitos, fotos: w.fotos,
      })),
      chat: chat.map((c): ChatAnswer => ({
        pregunta: c.pregunta, palabrasClave: c.palabras_clave, respuesta: c.respuesta,
        enlaceTexto: c.enlace_texto, enlaceRuta: c.enlace_ruta, destacada: c.destacada,
      })),
      acercaDeCarlos,
    };
  }

  async function requirePhotos(ids: number[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const found = await callPg<{ id_medio: number }>(sql, 'mediaByIds', [unique.join(',')]);
    if (found.length !== unique.length) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
  }

  type SaveRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; version: string | null };
  /** Traduce el resultado de un guardado con versión: 404 si no existe, 409 si otro guardó antes. */
  const saved = (rows: SaveRow[]) => {
    const [row] = rows;
    if (!row) throw new ApiError(404, 'No encontrado');
    if (row.resultado === 'conflicto') throw new ApiError(409, CONTENT_CONFLICT);
    return { version: row.version };
  };
  type Latest = { id_publicacion: number; estado: string; contenido: Snapshot };
  const initialTexts = async () => Object.fromEntries(
    (await callPg<{ clave: string; valor: string }>(sql, 'textsInitial')).map(t => [t.clave, t.valor]));

  return {
    snapshot,

    /** El borrador con la misma forma que `current()`: es lo que compila la vista previa. */
    async draftSite(): Promise<Snapshot> {
      const [draft, originales] = await Promise.all([snapshot(), initialTexts()]);
      return { ...draft, textos: { ...originales, ...draft.textos }, originales };
    },

    /**
     * Borrador con la versión de cada parte. Las versiones se leen antes que el contenido: si alguien
     * guarda entre ambas lecturas, el siguiente guardado da conflicto en vez de pisar su cambio.
     */
    async get(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentEdit);
      const [{ versiones }] = await callPg<{ versiones: ContentVersions }>(sql, 'contentVersions');
      return { ...(await snapshot()), originales: await initialTexts(), versiones };
    },

    /** `null` recupera el original conservado en la base. */
    async saveText(access: string | undefined, key: string, value: string | null, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!KEY.test(key) || key.length > 120) throw new ApiError(422, 'Clave de texto no válida');
      // Los enlaces de redes van a un href: se validan aparte para que no entre nada que no sea su red.
      const text = value === null ? null
        : key.startsWith('enlace.') ? linkValue(key, value) : plainText(value, 'Texto', 1000, { multiline: true });
      return saved(await callPg<SaveRow>(sql, 'textSave', [actor.id_usuario, key, text, version]));
    },

    async saveProposal(access: string | undefined, slug: string, input: ProposalInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const kpis = input.kpis.map((k, i) => ({
        etiqueta: plainText(k.etiqueta, `Cifra ${i + 1} · etiqueta`, 60),
        valor: plainText(k.valor, `Cifra ${i + 1} · valor`, 30),
      }));
      return saved(await callPg<SaveRow>(sql, 'proposalSave', [
        actor.id_usuario, slug, plainText(input.nombre, 'Nombre', 120),
        plainText(input.categoria, 'Categoría', 80), plainText(input.introduccion, 'Introducción', 400, { multiline: true }), kpis, version,
      ]));
    },

    async saveBiography(access: string | undefined, items: BiographyInput[], version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const clean = items.map((h, i) => ({
        anios: year(h.anios, `Hito ${i + 1} · año`),
        titulo: plainText(h.titulo, `Hito ${i + 1} · título`, 120),
        texto: plainText(h.texto, `Hito ${i + 1} · texto`, 3000, { multiline: true }),
        idMedio: h.idMedio,
        alt: h.idMedio === null ? null : plainText(h.alt ?? '', `Hito ${i + 1} · descripción de la foto`, 200),
      }));
      await requirePhotos(clean.flatMap(h => (h.idMedio === null ? [] : [h.idMedio])));
      return saved(await callPg<SaveRow>(sql, 'biographySave', [actor.id_usuario, clean, version]));
    },

    async saveWork(access: string | undefined, slug: string, input: WorkInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const hitos = input.hitos.map((h, i) => ({ nombre: plainText(h.nombre, `Hito ${i + 1}`, 120), completado: h.completado }));
      const fotos = input.fotos.map((f, i) => ({ idMedio: f.idMedio, pie: plainText(f.pie, `Foto ${i + 1} · pie`, 200) }));
      await requirePhotos(fotos.map(f => f.idMedio));
      return saved(await callPg<SaveRow>(sql, 'workSave', [
        actor.id_usuario, slug, plainText(input.nota, 'Nota', 600, { multiline: true }),
        hitos, fotos, version,
      ]));
    },

    /** Reemplaza las preguntas frecuentes del chat (lista completa, en orden). */
    async saveChat(access: string | undefined, items: ChatAnswer[], version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const clean = items.map((c, i) => {
        const field = `Pregunta ${i + 1}`;
        const linkText = c.enlaceTexto?.trim() ? plainText(c.enlaceTexto, `${field} · texto del enlace`, 60) : null;
        const linkPath = c.enlaceRuta?.trim() ? sitePath(c.enlaceRuta, `${field} · página del sitio`) : null;
        if (!linkText !== !linkPath) throw new ApiError(422, `${field}: el enlace necesita texto y página`);
        return {
          pregunta: plainText(c.pregunta, `${field} · pregunta`, 160),
          palabrasClave: plainText(c.palabrasClave, `${field} · palabras clave`, 300),
          respuesta: plainText(c.respuesta, `${field} · respuesta`, 1000, { multiline: true }),
          enlaceTexto: linkText, enlaceRuta: linkPath, destacada: c.destacada,
        };
      });
      return saved(await callPg<SaveRow>(sql, 'chatSave', [actor.id_usuario, clean, version]));
    },

    async unanswered(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const rows = await callPg<{ texto_normalizado: string; ejemplo: string; veces: number; ultima_vez: string }>(
        sql, 'chatUnansweredList', [actor.id_usuario, 50]);
      return { preguntas: rows.map(r => ({ clave: r.texto_normalizado, ejemplo: r.ejemplo, veces: r.veces, ultimaVez: r.ultima_vez })) };
    },

    async discardUnanswered(access: string | undefined, key: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      await callPg(sql, 'chatUnansweredDelete', [actor.id_usuario, key]);
      return { ok: true };
    },

    /** Lista lo que cambió respecto de lo último enviado a publicar (en cola, compilándose o publicado). */
    async pending(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentPublish);
      const [[last], current] = await Promise.all([callPg<Latest>(sql, 'publicationLatest'), snapshot()]);
      const originales=await initialTexts();
      return { cambios: diff(last ? { ...last.contenido,textos:{...originales,...last.contenido.textos} } : null, current) };
    },

    /**
     * Idempotente: si lo mismo ya está en cola o compilándose, devuelve esa publicación en vez de
     * crear otra. La base repite la comprobación con un bloqueo por si dos personas publican a la vez.
     */
    async publish(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentPublish);
      const [[last], current] = await Promise.all([callPg<Latest>(sql, 'publicationLatest'), snapshot()]);
      const originales=await initialTexts();
      if (last && !diff({ ...last.contenido,textos:{...originales,...last.contenido.textos} }, current).length) {
        if (last.estado === 'publicada') throw new ApiError(409, 'No hay cambios para publicar');
        return { id: last.id_publicacion, estado: last.estado };
      }
      const [row] = await callPg<{ id_publicacion: number; estado: string }>(sql, 'publicationCreate', [actor.id_usuario, current]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return { id: row.id_publicacion, estado: row.estado };
    },

    /** Contenido público vigente; no requiere sesión porque es lo mismo que muestra el sitio. */
    async current(): Promise<Snapshot> {
      const [row] = await callPg<{ contenido: Snapshot }>(sql, 'publicationCurrent');
      if (!row) throw new ApiError(404, 'Aún no hay contenido publicado');
      const originales = await initialTexts();
      return { ...row.contenido, textos: { ...originales, ...row.contenido.textos }, originales };
    },

    async publications(access: string | undefined, page: number) {
      await authorization.require(access, PERMISSIONS.contentPublish);
      const rows = await callPg<{
        id_publicacion: number | null; estado: string; creado_en: string; iniciado_en: string | null;
        terminado_en: string | null; detalle: string | null; autor: string | null; total: string;
      }>(sql, 'publicationsList', [PUBLICATIONS_PAGE_SIZE, (page - 1) * PUBLICATIONS_PAGE_SIZE]);
      return {
        total: Number(rows[0]?.total ?? 0), pagina: page, porPagina: PUBLICATIONS_PAGE_SIZE,
        publicaciones: rows.filter(r => r.id_publicacion !== null).map(r => ({
          id: r.id_publicacion, estado: r.estado, creadoEn: r.creado_en, iniciadoEn: r.iniciado_en,
          terminadoEn: r.terminado_en, autor: r.autor,
          // El registro de la compilación puede contener rutas del servidor: solo se indica que falló.
          detalle: r.estado === 'fallida' ? 'La compilación falló; el sitio sigue con la versión anterior.' : null,
        })),
      };
    },
  };
}

/** JSON con las claves ordenadas: PostgreSQL reordena las de jsonb y no deben contar como cambio. */
const stable = (value: unknown): string => JSON.stringify(value, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

const PAGE_NAMES: Record<string, string> = {
  'por-que-quiero-ser-alcalde': 'Por qué quiero ser alcalde', 'conoce-mas': 'Conoce más sobre Carlos',
};
const EMPTY_PAGE = { tarjetas: [], video: null, retrato: null, entrevista: [], galeria: [] };

/** Cambios entre dos versiones del contenido, descritos para el panel. */
export function diff(before: Snapshot | null, after: Snapshot) {
  if (!before) return [{ tipo: 'Sitio', descripcion: 'Primera publicación con el contenido del panel' }];
  const changes: { tipo: string; descripcion: string }[] = [];
  const same = (a: unknown, b: unknown) => stable(a) === stable(b);
  const keys = new Set([...Object.keys(before.textos), ...Object.keys(after.textos)]);
  for (const key of [...keys].sort())
    if (before.textos[key] !== after.textos[key]) changes.push({ tipo: 'Texto', descripcion: key });
  for (const p of after.propuestas) {
    const old = before.propuestas.find(b => b.slug === p.slug);
    if (!same(old, p)) changes.push({ tipo: 'Propuesta', descripcion: p.nombre });
  }
  if (!same(before.biografia, after.biografia)) changes.push({ tipo: 'Biografía', descripcion: 'Línea de tiempo' });
  for (const o of after.obras) {
    const old = before.obras.find(b => b.slug === o.slug);
    const name = after.propuestas.find(p => p.slug === o.slug)?.nombre ?? o.slug;
    if (!same({ ...old, actualizadoEn: 0 }, { ...o, actualizadoEn: 0 })) changes.push({ tipo: 'Obra', descripcion: name });
  }
  if (!same(before.chat ?? [], after.chat ?? [])) changes.push({ tipo: 'Chat', descripcion: 'Preguntas frecuentes' });
  for (const [slug, page] of Object.entries(after.acercaDeCarlos ?? {}))
    if (!same(before.acercaDeCarlos?.[slug] ?? EMPTY_PAGE, page)) changes.push({ tipo: 'Página', descripcion: PAGE_NAMES[slug] ?? slug });
  return changes;
}

export type Content = ReturnType<typeof createContent>;
export type { ProposalContent };
