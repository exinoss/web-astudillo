import type { SQL } from 'bun';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
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

type MediaRow = { id_medio: number; nombre: string; ancho: number; alto: number; anchos: number[] };

export const toPhoto = (row: MediaRow): Photo => ({
  idMedio: row.id_medio, nombre: row.nombre, ancho: row.ancho, alto: row.alto, anchos: row.anchos,
});

/** Crea la subida de fotos: valida el contenido real, genera variantes WebP y quita metadatos. */
export function createMedia(sql: SQL, authorization: Authorization, mediaDir: string) {
  return {
    async upload(access: string | undefined, file: File): Promise<Photo> {
      const actor = await authorization.require(access, PERMISSIONS.mediaUpload);
      if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'La foto supera los 8 MB');
      const input = Buffer.from(await file.arrayBuffer());
      // El tipo se decide por el contenido, no por la extensión ni el Content-Type del navegador.
      const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()
        .catch(() => { throw new ApiError(415, 'Sube una foto JPG, PNG o WebP'); });
      if (!metadata.format || !FORMATS.has(metadata.format)) throw new ApiError(415, 'Sube una foto JPG, PNG o WebP');

      // rotate() aplica la orientación EXIF antes de descartarla; sharp no copia metadatos (GPS incluido).
      const base = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
      // Orientaciones EXIF 5 a 8 giran la foto 90°: ancho y alto se intercambian.
      const turned = (metadata.orientation ?? 1) >= 5;
      const width = (turned ? metadata.height : metadata.width) ?? 0;
      const height = (turned ? metadata.width : metadata.height) ?? 0;
      const widths = WIDTHS.filter(w => w < width).concat(Math.min(width, WIDTHS.at(-1)!))
        .filter((w, i, all) => all.indexOf(w) === i).sort((a, b) => a - b);
      const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
      await mkdir(mediaDir, { recursive: true });
      await Promise.all(widths.map(w => base.clone().resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 }).toFile(join(mediaDir, `${name}-${w}.webp`))));
      const [row] = await callPg<MediaRow>(sql, 'mediaCreate', [actor.id_usuario, name, width, height, widths.join(',')]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return toPhoto(row);
    },
  };
}
