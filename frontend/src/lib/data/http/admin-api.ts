import { apiRequest } from './api-client';

/** Foto subida desde el panel (la devuelve el backend ya optimizada). */
export interface Photo { idMedio: number; nombre: string; ancho: number; alto: number; anchos: number[] }
export interface DraftProposal { slug: string; nombre: string; categoria: string; introduccion: string; kpis: { etiqueta: string; valor: string }[] }
export interface DraftBiographyItem { anios: string; titulo: string; texto: string; foto: Photo | null; alt: string | null }
export interface DraftWork {
  slug: string; nota: string; actualizadoEn: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: (Photo & { pie: string })[];
}
/** Borrador vivo del contenido; misma forma que se congela al publicar. */
export interface Draft {
  textos: Record<string, string>;
  propuestas: DraftProposal[];
  biografia: DraftBiographyItem[];
  obras: DraftWork[];
}
export interface Page { total: number; pagina: number; porPagina: number }
export interface AdminUser {
  id: number; correo: string; nombresCompletos: string | null; rol: string; estado: 'activo' | 'bloqueado';
  esMaestro?: boolean; rolesAsignables: string[]; puedeCambiarEstado: boolean; motivoBloqueo: string | null;
}
export interface Publication {
  id: number; estado: 'en_cola' | 'publicando' | 'publicada' | 'fallida';
  creadoEn: string; iniciadoEn: string | null; terminadoEn: string | null; autor: string | null; detalle: string | null;
}

const call = <T>(path: string, method = 'GET', body?: object | FormData) => apiRequest<T>(path, method, body, true);

/** Llamadas del panel y del modo edición. La autorización real la decide el backend. */
export const adminApi = {
  draft: () => call<Draft>('/api/admin/contenido'),
  saveText: (clave: string, valor: string | null) =>
    call<{ clave: string }>(`/api/admin/contenido/textos/${encodeURIComponent(clave)}`, 'PUT', { valor }),
  saveProposal: (slug: string, body: Omit<DraftProposal, 'slug'>) =>
    call(`/api/admin/contenido/propuestas/${slug}`, 'PUT', body),
  saveBiography: (hitos: { anios: string; titulo: string; texto: string; idMedio: number | null; alt: string | null }[]) =>
    call('/api/admin/contenido/biografia', 'PUT', { hitos }),
  saveWork: (slug: string, body: { nota: string; hitos: DraftWork['hitos']; fotos: { idMedio: number; pie: string }[] }) =>
    call(`/api/admin/contenido/obras/${slug}`, 'PUT', body),
  upload: (file: File) => {
    const form = new FormData();
    form.append('foto', file);
    return call<Photo>('/api/admin/medios', 'POST', form);
  },
  pending: () => call<{ cambios: { tipo: string; descripcion: string }[] }>('/api/admin/publicaciones/pendientes'),
  publish: () => call<{ id: number }>('/api/admin/publicaciones', 'POST'),
  publications: (pagina: number) => call<Page & { publicaciones: Publication[] }>(`/api/admin/publicaciones?pagina=${pagina}`),
  users: (filtros: { q?: string; rol?: string; estado?: string; pagina: number }) => {
    const query = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]));
    return call<Page & { usuarios: AdminUser[] }>(`/api/admin/usuarios?${query}`);
  },
  changeRole: (id: number, rol: string) => call(`/api/admin/usuarios/${id}/rol`, 'PATCH', { rol }),
  changeState: (id: number, estado: 'activo' | 'bloqueado') => call(`/api/admin/usuarios/${id}/estado`, 'PATCH', { estado }),
};
