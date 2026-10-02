import type { AlertType, ParticipationState, SentAlert, SentSuggestion } from '../types';
import { apiRequest } from './api-client';

export interface Photo { idMedio: number; nombre: string; ancho: number; alto: number; anchos: number[] }
export interface DraftProposal { slug: string; nombre: string; categoria: string; introduccion: string; kpis: { etiqueta: string; valor: string }[] }
export interface DraftBiographyItem { anios: string; titulo: string; texto: string; foto: Photo | null; alt: string | null }
export interface DraftWork {
  slug: string; nota: string; actualizadoEn: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: (Photo & { pie: string })[];
}
/** Pregunta frecuente del chat; `enlaceRuta` es una página del propio sitio. */
export interface ChatAnswer {
  pregunta: string; palabrasClave: string; respuesta: string;
  enlaceTexto: string | null; enlaceRuta: string | null; destacada: boolean;
}
/**
 * Versión de cada parte del borrador al cargarlo. Se envía al guardar: si otra persona guardó
 * antes, la API responde 409 y no se pisa su cambio. Un texto nunca cambiado no tiene versión.
 */
export interface DraftVersions {
  textos: Record<string, string>;
  propuestas: Record<string, string>;
  biografia: string;
  obras: Record<string, string>;
  chat: string;
}
/** Borrador vivo del contenido; misma forma que se congela al publicar, más sus versiones. */
export interface Draft {
  textos: Record<string, string>;
  propuestas: DraftProposal[];
  biografia: DraftBiographyItem[];
  obras: DraftWork[];
  chat: ChatAnswer[];
  versiones: DraftVersions;
}
type Saved = { version: string | null };
export interface Page { total: number; pagina: number; porPagina: number }
export interface AdminUser {
  id: number; correo: string; nombresCompletos: string | null; rol: string; estado: 'activo' | 'bloqueado';
  rolesAsignables: string[]; puedeCambiarEstado: boolean; motivoBloqueo: string | null;
}
export type ReviewedAlert = SentAlert & { autor: string | null; correo: string };
export type ReviewedSuggestion = SentSuggestion & { autor: string | null; correo: string };
export type ParticipationKind = 'alertas' | 'sugerencias';
export interface ParticipationPage<T> extends Omit<Page, 'total'> {
  items: T[];
  conteo: Record<ParticipationKind, Record<ParticipationState, number>>;
}
export type { AlertType, ParticipationState };
export interface Publication {
  id: number; estado: 'en_cola' | 'publicando' | 'publicada' | 'fallida';
  creadoEn: string; iniciadoEn: string | null; terminadoEn: string | null; autor: string | null; detalle: string | null;
}

const call = <T>(path: string, method = 'GET', body?: object | FormData) => apiRequest<T>(path, method, body, true);

/** Llamadas del panel y del modo edición. La autorización real la decide el backend. */
export const adminApi = {
  draft: () => call<Draft>('/api/admin/contenido'),
  saveText: (clave: string, valor: string | null, version: string | null) =>
    call<Saved>(`/api/admin/contenido/textos/${encodeURIComponent(clave)}`, 'PUT', { valor, version }),
  saveProposal: (slug: string, body: Omit<DraftProposal, 'slug'>, version: string) =>
    call<Saved>(`/api/admin/contenido/propuestas/${slug}`, 'PUT', { ...body, version }),
  saveBiography: (hitos: { anios: string; titulo: string; texto: string; idMedio: number | null; alt: string | null }[], version: string) =>
    call<Saved>('/api/admin/contenido/biografia', 'PUT', { hitos, version }),
  saveWork: (slug: string, body: { nota: string; hitos: DraftWork['hitos']; fotos: { idMedio: number; pie: string }[] }, version: string) =>
    call<Saved>(`/api/admin/contenido/obras/${slug}`, 'PUT', { ...body, version }),
  upload: (file: File) => {
    const form = new FormData();
    form.append('foto', file);
    return call<Photo>('/api/admin/medios', 'POST', form);
  },
  saveChat: (respuestas: ChatAnswer[], version: string) => call<Saved>('/api/admin/contenido/chat', 'PUT', { respuestas, version }),
  unanswered: () => call<{ preguntas: { clave: string; ejemplo: string; veces: number; ultimaVez: string }[] }>('/api/admin/chat/sin-respuesta'),
  discardUnanswered: (clave: string) => call(`/api/admin/chat/sin-respuesta/${encodeURIComponent(clave)}`, 'DELETE'),
  participation: <T>(tipo: ParticipationKind, pagina: number, estado?: ParticipationState) =>
    call<ParticipationPage<T>>(`/api/admin/participacion/${tipo}?${new URLSearchParams({ pagina: String(pagina), ...(estado ? { estado } : {}) })}`),
  // Se envía el estado que se veía: si otra persona lo cambió mientras tanto, la API responde 409.
  changeParticipationState: (tipo: ParticipationKind, id: number, estado: ParticipationState, estadoAnterior: ParticipationState) =>
    call<{ estado: ParticipationState }>(`/api/admin/participacion/${tipo}/${id}/estado`, 'PATCH', { estado, estadoAnterior }),
  pending: () => call<{ cambios: { tipo: string; descripcion: string }[] }>('/api/admin/publicaciones/pendientes'),
  /** Idempotente: si lo mismo ya está en cola o compilándose, devuelve esa publicación. */
  publish: () => call<{ id: number; estado: Publication['estado'] }>('/api/admin/publicaciones', 'POST'),
  publications: (pagina: number) => call<Page & { publicaciones: Publication[] }>(`/api/admin/publicaciones?pagina=${pagina}`),
  users: (filtros: { q?: string; rol?: string; estado?: string; pagina: number }) => {
    const query = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]));
    return call<Page & { usuarios: AdminUser[] }>(`/api/admin/usuarios?${query}`);
  },
  // Se envía lo que se veía en la lista: si otro admin cambió la cuenta mientras tanto, responde 409.
  changeRole: (id: number, rol: string, rolAnterior: string) =>
    call(`/api/admin/usuarios/${id}/rol`, 'PATCH', { rol, rolAnterior }),
  changeState: (id: number, estado: 'activo' | 'bloqueado', estadoAnterior: 'activo' | 'bloqueado') =>
    call(`/api/admin/usuarios/${id}/estado`, 'PATCH', { estado, estadoAnterior }),
};
