import type { SQL } from 'bun';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import type { Photo } from '../types';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const WIDTHS = [480, 960, 1600];
// Tope de píxeles por debajo del de sharp: una imagen «bomba» pequeña en bytes no agota la memoria.
const MAX_PIXELS = 40_000_000;
const FORMATS = new Set(['jpeg', 'png', 'webp']);
const WRONG_FORMAT = 'Sube una foto JPG, PNG o WebP';

type MediaRow = { id_medio: number; nombre: string; ancho: number; alto: number; anchos: number[] };

export const toPhoto = (row: MediaRow): Photo => ({
  idMedio: row.id_medio, nombre: row.nombre, ancho: row.ancho, alto: row.alto, anchos: row.anchos,
});

export const sha256 = (input: Buffer) => createHash('sha256').update(input).digest('hex');

/**
 * Valida la foto por su contenido y la guarda como `<nombre>-<ancho>.webp` en cada ancho de `sizes`.
 * Aplica la orientación EXIF y descarta los metadatos (GPS incluido). Con `allSizes` escribe todos los
 * anchos aunque la foto sea menor (sin ampliarla); si no, solo los que caben más el tamaño original.
 * Cada archivo se escribe aparte y se renombra al final: dos escrituras simultáneas no lo dejan a medias.
 */
export async function savePhoto(input: Buffer, dir: string, name: string, sizes: number[], allSizes = false) {
  const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()
    .catch(() => { throw new ApiError(415, WRONG_FORMAT); });
  if (!metadata.format || !FORMATS.has(metadata.format)) throw new ApiError(415, WRONG_FORMAT);
  const base = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
  // Orientaciones EXIF 5 a 8 giran la foto 90°: ancho y alto se intercambian.
  const turned = (metadata.orientation ?? 1) >= 5;
  const width = (turned ? metadata.height : metadata.width) ?? 0;
  const height = (turned ? metadata.width : metadata.height) ?? 0;
  const widths = allSizes ? sizes : sizes.filter(w => w < width).concat(Math.min(width, sizes.at(-1)!))
    .filter((w, i, all) => all.indexOf(w) === i).sort((a, b) => a - b);
  await mkdir(dir, { recursive: true });
  await Promise.all(widths.map(async w => {
    const target = join(dir, `${name}-${w}.webp`);
    const temporary = `${target}.${randomBytes(4).toString('hex')}.tmp`;
    await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temporary);
    await rename(temporary, target);
  }));
  return { width, height, widths };
}

export function createMedia(sql: SQL, authorization: Authorization, mediaDir: string) {
  return {
    async upload(access: string | undefined, file: File): Promise<Photo> {
      const actor = await authorization.require(access, PERMISSIONS.mediaUpload);
      if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'La foto supera los 8 MB');
      const input = Buffer.from(await file.arrayBuffer());
      // Idempotente: la misma foto otra vez (reintento, doble envío) devuelve la ya guardada.
      const hash = sha256(input);
      const [existing] = await callPg<MediaRow>(sql, 'mediaByHash', [hash]);
      if (existing) return toPhoto(existing);
      const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
      const { width, height, widths } = await savePhoto(input, mediaDir, name, WIDTHS);
      const [row] = await callPg<MediaRow>(sql, 'mediaCreate', [actor.id_usuario, name, width, height, widths.join(','), hash]);
      if (row) return toPhoto(row);
      // Otra subida simultánea del mismo archivo ganó: se usa la suya y se borran estos archivos.
      await Promise.all(widths.map(w => rm(join(mediaDir, `${name}-${w}.webp`), { force: true })));
      const [winner] = await callPg<MediaRow>(sql, 'mediaByHash', [hash]);
      if (!winner) throw new ApiError(403, 'Permiso insuficiente');
      return toPhoto(winner);
    },
  };
}
