import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import type { Aviso } from '../../contracts/avisos';
import { avisoNoInsertable, videoSource } from '../../contracts/video';
import { PAGE_NAMES } from '../../content/services/content';
import { videoInsertable } from '../../content/services/video-cover';
import type { Snapshot } from '../../content/types';
import { callPg } from '../../db/call';

const HORA = 60 * 60_000;
const GRUPOS = [
  { tipo: 'alertas', icono: 'location', nombre: ['alerta ciudadana', 'alertas ciudadanas'], accion: ['Revisarla', 'Revisarlas'] },
  { tipo: 'sugerencias', icono: 'bulb', nombre: ['sugerencia', 'sugerencias'], accion: ['Verla', 'Verlas'] },
] as const;
const ESTADOS = { recibida: ['nueva', 'nuevas'], en_revision: ['en revisión', 'en revisión'] } as const;
/** Enlace al lugar del panel que abre el aviso. */
const ruta = (clave: string, pestania: string) => `/cuenta/panel/?aviso=${encodeURIComponent(clave)}#${pestania}`;

/** Avisos del panel; `checkVideo` permite simular las plataformas de video en las pruebas. */
export function createNotices(sql: SQL, authorization: Authorization, checkVideo = videoInsertable) {
  // Cada comprobación pregunta a la plataforma: se recuerda una hora mientras no cambien los enlaces publicados.
  let videos: { enlaces: string; hasta: number; avisos: Promise<Aviso[]> } | null = null;

  /** Videos publicados que su plataforma ya no deja mostrar en el sitio. */
  async function videoNotices(): Promise<Aviso[]> {
    const [row] = await callPg<{ contenido: Snapshot }>(sql, 'publicationCurrent');
    const pages = Object.entries(row?.contenido.acercaDeCarlos ?? {}).flatMap(([slug, page]) => {
      const source = page.video && videoSource(page.video.enlace);
      return source ? [{ slug, source }] : [];
    });
    const enlaces = JSON.stringify(pages.map(p => [p.slug, p.source.url]));
    if (videos?.enlaces !== enlaces || videos.hasta < Date.now()) {
      const avisos = Promise.all(pages.map(async ({ slug, source }): Promise<Aviso[]> => {
        const motivo = await checkVideo(source);
        return motivo ? [{
          clave: `video:${slug}`, tipo: 'error', icono: 'alert', cantidad: 1, ruta: ruta(`video:${slug}`, 'acerca-de-carlos'),
          texto: `El video de «${PAGE_NAMES[slug] ?? slug}» ya no se puede ver en el sitio.`, accion: 'Cambiar el video',
          detalle: avisoNoInsertable(source.provider, motivo), valor: source.url,
        }] : [];
      })).then(lists => lists.flat());
      videos = { enlaces, hasta: Date.now() + HORA, avisos };
    }
    return videos.avisos;
  }

  /** Alertas y sugerencias que esperan revisión, agrupadas por estado; sin permiso para verlas, la base no devuelve nada. */
  async function participationNotices(actor: number): Promise<Aviso[]> {
    const counts = await callPg<{ tipo: string; estado: string; total: number }>(sql, 'participationCounts', [actor]);
    return GRUPOS.flatMap(g => (Object.keys(ESTADOS) as (keyof typeof ESTADOS)[]).flatMap((estado): Aviso[] => {
      const n = Number(counts.find(c => c.tipo === g.tipo && c.estado === estado)?.total ?? 0);
      const varias = Number(n !== 1);
      return n ? [{
        clave: `${g.tipo}:${estado}`, tipo: 'pendiente', icono: g.icono, cantidad: n, ruta: ruta(`${g.tipo}:${estado}`, 'participacion'),
        texto: `${n} ${g.nombre[varias]} ${ESTADOS[estado][varias]}`, accion: g.accion[varias],
      }] : [];
    }));
  }

  return {
    /** Lo que la campana muestra a quien puede editar el contenido: primero los errores, luego lo pendiente. */
    async list(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const [errores, pendientes] = await Promise.all([videoNotices(), participationNotices(actor.id_usuario)]);
      return { avisos: [...errores, ...pendientes] };
    },
  };
}
