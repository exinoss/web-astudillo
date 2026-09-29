import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import type { BiographyItem, Kpi, ProposalContent, Snapshot, WorkContent } from '../types';
import { toPhoto } from './media';
import { plainText } from './validation';

export const PUBLICATIONS_PAGE_SIZE = 10;
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

export interface ProposalInput { nombre: string; categoria: string; introduccion: string; kpis: Kpi[] }
export interface BiographyInput { anios: string; titulo: string; texto: string; idMedio: number | null; alt: string | null }
export interface WorkInput {
  nota: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: { idMedio: number; pie: string }[];
}

/** Crea la gestión del contenido editable y de sus publicaciones. */
export function createContent(sql: SQL, authorization: Authorization) {
  /** Lee el borrador actual completo, con la misma forma que se congela al publicar. */
  async function snapshot(): Promise<Snapshot> {
    const [texts, proposals, biography, works] = await Promise.all([
      callPg<{ clave: string; valor: string }>(sql, 'textsList'),
      callPg<ProposalRow>(sql, 'proposalsList'),
      callPg<BiographyRow>(sql, 'biographyList'),
      callPg<WorkRow>(sql, 'worksList'),
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
    };
  }

  /** Comprueba que las fotos referenciadas existen antes de guardarlas. */
  async function requirePhotos(ids: number[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const found = await callPg<{ id_medio: number }>(sql, 'mediaByIds', [unique.join(',')]);
    if (found.length !== unique.length) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
  }

  const saved = <T>(rows: T[]) => {
    if (!rows.length) throw new ApiError(404, 'No encontrado');
    return rows[0];
  };

  return {
    snapshot,

    async get(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentEdit);
      return snapshot();
    },

    /** Guarda un texto del sitio; `null` lo devuelve al texto por defecto del código. */
    async saveText(access: string | undefined, key: string, value: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!KEY.test(key) || key.length > 120) throw new ApiError(422, 'Clave de texto no válida');
      const text = value === null ? null : plainText(value, 'Texto', 1000, { multiline: true });
      return saved(await callPg<{ clave: string; valor: string | null }>(sql, 'textSave', [actor.id_usuario, key, text]));
    },

    async saveProposal(access: string | undefined, slug: string, input: ProposalInput) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const kpis = input.kpis.map((k, i) => ({
        etiqueta: plainText(k.etiqueta, `Cifra ${i + 1} · etiqueta`, 60),
        valor: plainText(k.valor, `Cifra ${i + 1} · valor`, 30),
      }));
      return saved(await callPg(sql, 'proposalSave', [
        actor.id_usuario, slug, plainText(input.nombre, 'Nombre', 120),
        plainText(input.categoria, 'Categoría', 80), plainText(input.introduccion, 'Introducción', 400), kpis,
      ]));
    },

    async saveBiography(access: string | undefined, items: BiographyInput[]) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const clean = items.map((h, i) => ({
        anios: plainText(h.anios, `Hito ${i + 1} · años`, 40),
        titulo: plainText(h.titulo, `Hito ${i + 1} · título`, 120),
        texto: plainText(h.texto, `Hito ${i + 1} · texto`, 3000, { multiline: true }),
        idMedio: h.idMedio,
        alt: h.idMedio === null ? null : plainText(h.alt ?? '', `Hito ${i + 1} · descripción de la foto`, 200),
      }));
      await requirePhotos(clean.flatMap(h => (h.idMedio === null ? [] : [h.idMedio])));
      return saved(await callPg<{ total: number }>(sql, 'biographySave', [actor.id_usuario, clean]));
    },

    async saveWork(access: string | undefined, slug: string, input: WorkInput) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const hitos = input.hitos.map((h, i) => ({ nombre: plainText(h.nombre, `Hito ${i + 1}`, 120), completado: h.completado }));
      const fotos = input.fotos.map((f, i) => ({ idMedio: f.idMedio, pie: plainText(f.pie, `Foto ${i + 1} · pie`, 200) }));
      await requirePhotos(fotos.map(f => f.idMedio));
      return saved(await callPg(sql, 'workSave', [
        actor.id_usuario, slug, plainText(input.nota, 'Nota', 600, { multiline: true }),
        hitos, fotos,
      ]));
    },

    /** Lista lo que cambió respecto de la última publicación que llegó al sitio. */
    async pending(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentPublish);
      const [[last], current] = await Promise.all([
        callPg<{ contenido: Snapshot }>(sql, 'publicationLastPublished'), snapshot(),
      ]);
      return { cambios: diff(last?.contenido ?? null, current) };
    },

    async publish(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentPublish);
      const [[last], current] = await Promise.all([
        callPg<{ contenido: Snapshot }>(sql, 'publicationLastPublished'), snapshot(),
      ]);
      if (last && !diff(last.contenido, current).length) throw new ApiError(409, 'No hay cambios para publicar');
      const [row] = await callPg<{ id_publicacion: number }>(sql, 'publicationCreate', [actor.id_usuario, current]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return { id: row.id_publicacion, estado: 'en_cola' };
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
  return changes;
}

export type Content = ReturnType<typeof createContent>;
export type { ProposalContent };
