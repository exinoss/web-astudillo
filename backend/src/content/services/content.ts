import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { plainText } from '../../validation/texto';
import { existingPhotos, saved, type SaveRow } from '../guardado';
import type { BiographyItem, ChatAnswer, ContentVersions, Kpi, ProposalContent, Snapshot, WorkContent } from '../types';
import { PARROQUIAS } from '../../contracts/parroquias';
import { videoSource } from '../../contracts/video';
import { PAGINAS_CARLOS } from '../../contracts/acerca-de-carlos';
import { LARGOS } from '../../contracts/limites';
import { TEXTOS, type TextKey } from '../../contracts/textos';
import { listAboutCarlosPages } from './about-carlos';
import { emptyMyTeam, listMyTeam } from './my-team';
import { HOME_CAROUSELS_SEED, listHomeCarousels } from './home-carousels';
import { toPhoto } from './media';
import { linkValue, sitePath, year } from './validation';
import { videoInsertable } from './video-cover';

const PUBLICATIONS_PAGE_SIZE = 10;
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

interface ProposalInput { nombre: string; categoria: string; introduccion: string; kpis: Kpi[] }
interface BiographyInput { anios: string; titulo: string; texto: string; idMedio: number | null; alt: string | null }
interface WorkInput {
  nota: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: { idMedio: number; pie: string }[];
}

/** Borrador, publicación y textos del sitio; `checkVideo` permite simular las plataformas de video en las pruebas. */
export function createContent(sql: SQL, authorization: Authorization, checkVideo = videoInsertable) {
  /** Lee el borrador actual completo, con la misma forma que se congela al publicar. */
  async function snapshot(): Promise<Snapshot> {
    // En una transacción REPEATABLE READ las ocho lecturas ven el mismo instante; sueltas, dos guardados
    // hechos entre ellas podrían quedar publicados a medias.
    const [texts, proposals, biography, works, chat, acercaDeCarlos, miEquipo, inicio] = await sql.begin('isolation level repeatable read read only', tx => Promise.all([
      callPg<{ clave: string; valor: string }>(tx, 'textsList'),
      callPg<ProposalRow>(tx, 'proposalsList'),
      callPg<BiographyRow>(tx, 'biographyList'),
      callPg<WorkRow>(tx, 'worksList'),
      callPg<ChatRow>(tx, 'chatList'),
      listAboutCarlosPages(tx),
      listMyTeam(tx),
      listHomeCarousels(tx),
    ]));
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
      miEquipo,
      inicio,
    };
  }

  type Latest = { id_publicacion: number; estado: string; contenido: Snapshot };
  const initialTexts = async () => Object.fromEntries(
    (await callPg<{ clave: string; valor: string }>(sql, 'textsInitial')).map(t => [t.clave, t.valor]));

  /** Completa los textos con el original de los que nadie cambió y adjunta los originales. */
  async function withOriginals(contenido: Snapshot): Promise<Snapshot> {
    const originales = await initialTexts();
    return { ...contenido, textos: { ...originales, ...contenido.textos }, originales };
  }

  /** Lo último enviado a publicar, el borrador y lo que cambió entre los dos. */
  async function pendingChanges() {
    const [[last], current] = await Promise.all([callPg<Latest>(sql, 'publicationLatest'), snapshot()]);
    return { last, current, cambios: diff(last ? await withOriginals(last.contenido) : null, current) };
  }

  return {
    snapshot,

    /** El borrador con la misma forma que `current()`: es lo que compila la vista previa. */
    draftSite: async () => withOriginals(await snapshot()),

    /** Borrador con sus versiones, leídas antes que el contenido para que un guardado intermedio dé conflicto. */
    async get(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentEdit);
      const [{ versiones }] = await callPg<{ versiones: ContentVersions }>(sql, 'contentVersions');
      return { ...(await snapshot()), originales: await initialTexts(), versiones };
    },

    /** `null` recupera el original conservado en la base. */
    async saveText(access: string | undefined, key: string, value: string | null, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const link = key.startsWith('enlace.');
      if (!KEY.test(key) || key.length > 120 || (!link && !Object.hasOwn(TEXTOS, key)))
        throw new ApiError(422, 'Clave de texto no válida');
      // Los enlaces de redes van a un href: se validan aparte para que no entre nada que no sea su red.
      const text = value === null ? null
        : link ? linkValue(key, value) : plainText(value, 'Texto', TEXTOS[key as TextKey].max, { multiline: true });
      return saved(await callPg<SaveRow>(sql, 'textSave', [actor.id_usuario, key, text, version]));
    },

    async saveProposal(access: string | undefined, slug: string, input: ProposalInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const kpis = input.kpis.map((k, i) => ({
        etiqueta: plainText(k.etiqueta, `Cifra ${i + 1} · etiqueta`, LARGOS.propuesta.etiquetaCifra),
        valor: plainText(k.valor, `Cifra ${i + 1} · valor`, LARGOS.propuesta.valorCifra),
      }));
      return saved(await callPg<SaveRow>(sql, 'proposalSave', [
        actor.id_usuario, slug, plainText(input.nombre, 'Nombre', LARGOS.propuesta.nombre),
        plainText(input.categoria, 'Categoría', LARGOS.propuesta.categoria), plainText(input.introduccion, 'Introducción', LARGOS.propuesta.introduccion, { multiline: true }), kpis, version,
      ]));
    },

    async saveBiography(access: string | undefined, items: BiographyInput[], version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const clean = items.map((h, i) => ({
        anios: year(h.anios, `Hito ${i + 1} · año`),
        titulo: plainText(h.titulo, `Hito ${i + 1} · título`, LARGOS.biografia.titulo),
        texto: plainText(h.texto, `Hito ${i + 1} · texto`, LARGOS.biografia.texto, { multiline: true }),
        idMedio: h.idMedio,
        alt: h.idMedio === null ? null : plainText(h.alt ?? '', `Hito ${i + 1} · descripción de la foto`, LARGOS.descripcionFoto),
      }));
      await existingPhotos(sql, clean.flatMap(h => (h.idMedio === null ? [] : [h.idMedio])));
      return saved(await callPg<SaveRow>(sql, 'biographySave', [actor.id_usuario, clean, version]));
    },

    async saveWork(access: string | undefined, slug: string, input: WorkInput, version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const hitos = input.hitos.map((h, i) => ({ nombre: plainText(h.nombre, `Hito ${i + 1}`, LARGOS.obra.hito), completado: h.completado }));
      const fotos = input.fotos.map((f, i) => ({ idMedio: f.idMedio, pie: plainText(f.pie, `Foto ${i + 1} · pie`, LARGOS.obra.pie) }));
      await existingPhotos(sql, fotos.map(f => f.idMedio));
      return saved(await callPg<SaveRow>(sql, 'workSave', [
        actor.id_usuario, slug, plainText(input.nota, 'Nota', LARGOS.obra.nota, { multiline: true }),
        hitos, fotos, version,
      ]));
    },

    /** Reemplaza las preguntas frecuentes del chat (lista completa, en orden). */
    async saveChat(access: string | undefined, items: ChatAnswer[], version: string) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const clean = items.map((c, i) => {
        const field = `Pregunta ${i + 1}`;
        const linkText = c.enlaceTexto?.trim() ? plainText(c.enlaceTexto, `${field} · texto del enlace`, LARGOS.chat.textoEnlace) : null;
        const linkPath = c.enlaceRuta?.trim() ? sitePath(c.enlaceRuta, `${field} · página del sitio`) : null;
        if (!linkText !== !linkPath) throw new ApiError(422, `${field}: el enlace necesita texto y página`);
        return {
          pregunta: plainText(c.pregunta, `${field} · pregunta`, LARGOS.chat.pregunta),
          palabrasClave: plainText(c.palabrasClave, `${field} · palabras clave`, LARGOS.chat.palabrasClave),
          respuesta: plainText(c.respuesta, `${field} · respuesta`, LARGOS.chat.respuesta, { multiline: true }),
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
      return { cambios: (await pendingChanges()).cambios };
    },

    /** Publica el borrador; es idempotente y la base lo repite con un bloqueo por si dos personas publican a la vez. */
    async publish(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentPublish);
      const { last, current, cambios } = await pendingChanges();
      if (last && !cambios.length) {
        if (last.estado === 'publicada') throw new ApiError(409, 'No hay cambios para publicar');
        return { id: last.id_publicacion, estado: last.estado };
      }
      // Mientras un video del borrador no se pueda ver en el sitio, no se publica nada (al guardar ya se comprueba).
      const videos = Object.entries(current.acercaDeCarlos ?? {}).flatMap(([slug, page]) => {
        const source = page.video && videoSource(page.video.enlace);
        return source ? [{ slug, source }] : [];
      });
      const checks = await Promise.all(videos.map(v => checkVideo(v.source)));
      const blocked = videos.find((_, i) => checks[i]);
      if (blocked) throw new ApiError(422, `No se publicó: el video de «${PAGE_NAMES[blocked.slug] ?? blocked.slug}» no se puede ver en el sitio. Cámbialo y vuelve a publicar.`);
      const [row] = await callPg<{ id_publicacion: number; estado: string }>(sql, 'publicationCreate', [actor.id_usuario, current]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return { id: row.id_publicacion, estado: row.estado };
    },

    /** Contenido público vigente; no requiere sesión porque es lo mismo que muestra el sitio. */
    async current(): Promise<Snapshot> {
      const [row] = await callPg<{ contenido: Snapshot }>(sql, 'publicationCurrent');
      if (!row) throw new ApiError(404, 'Aún no hay contenido publicado');
      return withOriginals(row.contenido);
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

export const PAGE_NAMES: Record<string, string> = PAGINAS_CARLOS;
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
  const team = before.miEquipo ?? emptyMyTeam();
  if (after.miEquipo) {
    if (!same(team.equipo, after.miEquipo.equipo)) changes.push({ tipo: 'Mi equipo', descripcion: 'Equipo' });
    for (const parish of after.miEquipo.parroquias)
      if (!same(team.parroquias.find(p => p.slug === parish.slug), parish))
        changes.push({ tipo: 'Mi equipo', descripcion: PARROQUIAS.find(p => p.slug === parish.slug)!.nombre });
  }
  const home = before.inicio ?? HOME_CAROUSELS_SEED;
  if (after.inicio) {
    if (!same(home.principal, after.inicio.principal)) changes.push({ tipo: 'Portada', descripcion: 'Carrusel principal' });
    if (!same(home.piezas, after.inicio.piezas)) changes.push({ tipo: 'Portada', descripcion: 'Carrusel de piezas' });
    if (!same(before.inicio?.equipo ?? { fotos: [] }, after.inicio.equipo)) changes.push({ tipo: 'Portada', descripcion: 'Carrusel del equipo' });
  }
  return changes;
}

export type Content = ReturnType<typeof createContent>;
export type { ProposalContent };
