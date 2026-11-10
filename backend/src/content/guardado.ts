import type { SQL } from 'bun';
import { ApiError } from '../http';
import { photosById } from './services/media';

const CONTENT_CONFLICT = 'Otra persona guardó cambios en este contenido mientras editabas. Recarga para ver su versión; lo tuyo no se guardó.';

export type SaveRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; version: string | null };

/** Traduce el resultado de un guardado con versión: 404 si no existe, 409 si otro guardó antes. */
export function saved([row]: SaveRow[]) {
  if (!row) throw new ApiError(404, 'No encontrado');
  if (row.resultado === 'conflicto') throw new ApiError(409, CONTENT_CONFLICT);
  return { version: row.version };
}

/** Fotos de los IDs pedidos; 422 si alguna ya no existe. */
export async function existingPhotos(sql: SQL, ids: number[]) {
  const media = await photosById(sql, ids);
  if (ids.some(id => !media.has(id))) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
  return media;
}
