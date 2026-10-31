import type { SQL } from 'bun';
import { link, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { AVISO_HEIC, avisoMegapixeles, CARD_SIZE, cardVariantFile, FORMATOS_FOTO, MAX_PIXELES } from '../../contracts/media';
import { videoLinkProblem, videoSource } from '../../contracts/video';
import { fetchVideoCover } from './video-cover';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import type { Photo } from '../types';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
// 2000: los banners de la portada ocupan todo el ancho, hasta 1947 px.
const WIDTHS = [480, 960, 1600, 2000];
const FORMATS = new Set(['jpeg', 'png', 'webp']);
const WRONG_FORMAT = `Sube una foto ${FORMATOS_FOTO}`;

type MediaRow = { id_medio: number; nombre: string; ancho: number; alto: number; anchos: number[] };

export const toPhoto = (row: MediaRow): Photo => ({
  idMedio: row.id_medio, nombre: row.nombre, ancho: row.ancho, alto: row.alto, anchos: row.anchos,
});

/** Las fotos que existen entre las pedidas; una borrada no aparece en el mapa. */
export async function photosById(sql: SQL, ids: number[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<number, Photo>();
  const rows = await callPg<MediaRow>(sql, 'mediaDetails', [unique.join(',')]);
  return new Map(rows.map(row => [row.id_medio, toPhoto(row)]));
}

export const sha256 = (input: Buffer) => createHash('sha256').update(input).digest('hex');

/** Null si la foto se puede guardar; si no, el aviso. HEIC y AVIF comparten contenedor (`heif`) y se distinguen por el códec. */
export function formatProblem({ format, compression }: { format?: string; compression?: string }) {
  if (format === 'heif') return compression === 'av1' ? null : compression === 'hevc' ? AVISO_HEIC : WRONG_FORMAT;
  return format && FORMATS.has(format) ? null : WRONG_FORMAT;
}

/**
 * Valida la foto por su contenido y la guarda como `<nombre>-<ancho>.webp` en cada ancho de `sizes`.
 * Aplica la orientación EXIF y descarta los metadatos (GPS incluido). Con `allSizes` escribe todos los
 * anchos aunque la foto sea menor (sin ampliarla); si no, solo los que caben más el tamaño original.
 * Un enlace atómico publica cada archivo completo; repetir una foto no reemplaza un archivo abierto.
 */
export async function savePhoto(input: Buffer, dir: string, name: string, sizes: number[], allSizes = false) {
  // Leer las medidas no abre la imagen: el tope de píxeles se comprueba aquí para avisar con un mensaje claro.
  const metadata = await sharp(input, { limitInputPixels: false }).metadata()
    .catch(() => { throw new ApiError(415, WRONG_FORMAT); });
  const problem = formatProblem(metadata);
  if (problem) throw new ApiError(415, problem);
  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (pixels > MAX_PIXELES) throw new ApiError(413, avisoMegapixeles(pixels));
  // Orientaciones EXIF 5 a 8 giran la foto 90°: ancho y alto se intercambian.
  const turned = (metadata.orientation ?? 1) >= 5;
  const width = (turned ? metadata.height : metadata.width) ?? 0;
  const height = (turned ? metadata.width : metadata.height) ?? 0;
  const widths = allSizes ? sizes : sizes.filter(w => w < width).concat(Math.min(width, sizes.at(-1)!))
    .filter((w, i, all) => all.indexOf(w) === i).sort((a, b) => a - b);
  const base = sharp(input, { limitInputPixels: MAX_PIXELES }).rotate();
  await mkdir(dir, { recursive: true });
  // Una versión detrás de otra: abierta, la foto completa ocupa ancho × alto × canales en memoria, y abrirla
  // para todas a la vez multiplicaría ese pico. Reducir desde una versión ya reducida cambiaría el resultado.
  for (const w of widths) {
    const target = join(dir, `${name}-${w}.webp`);
    const temporary = `${target}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temporary);
      // El destino completo se crea una sola vez: Windows no reemplaza un archivo que otro envío lee.
      await link(temporary, target).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      });
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return { width, height, widths };
}

const CARD_CURVE = Uint8Array.from({ length: 256 }, (_, v) =>
  Math.round(255 * Math.min(1, Math.max(0, 0.5 + ((v / 255) ** (1 / 1.3) - 0.5) * 1.8))));

/** Idempotente. Parte de la variante más grande guardada porque el original no se conserva. */
export async function ensureCardVariant(dir: string, photo: { nombre: string; anchos: number[] }) {
  const target = join(dir, cardVariantFile(photo.nombre));
  if (await Bun.file(target).exists()) return;
  const source = join(dir, `${photo.nombre}-${Math.max(...photo.anchos)}.webp`);
  // Desde memoria: con la ruta, sharp deja el archivo abierto en su caché y en Windows no se puede borrar después.
  const { data, info } = await sharp(Buffer.from(await Bun.file(source).arrayBuffer()))
    .resize({ width: CARD_SIZE, height: CARD_SIZE, fit: 'outside', withoutEnlargement: true })
    .toColourspace('b-w').normalise({ lower: 5, upper: 95 }).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i++) data[i] = CARD_CURVE[data[i]];
  const temporary = `${target}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).webp({ quality: 80 }).toFile(temporary);
    await link(temporary, target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
  } finally {
    await rm(temporary, { force: true });
  }
}

export function createMedia(sql: SQL, authorization: Authorization, mediaDir: string, fetchCover = fetchVideoCover) {
  async function store(actor: number, input: Buffer): Promise<Photo> {
    // Idempotente: la misma foto otra vez (reintento, doble envío) devuelve la ya guardada.
    const hash = sha256(input);
    const [existing] = await callPg<MediaRow>(sql, 'mediaByHash', [hash]);
    if (existing) {
      await ensureCardVariant(mediaDir, existing);
      return toPhoto(existing);
    }
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
    const { width, height, widths } = await savePhoto(input, mediaDir, name, WIDTHS);
    await ensureCardVariant(mediaDir, { nombre: name, anchos: widths });
    const [row] = await callPg<MediaRow>(sql, 'mediaCreate', [actor, name, width, height, widths.join(','), hash]);
    if (row) return toPhoto(row);
    // Otra subida simultánea del mismo archivo ganó: se usa la suya y se borran estos archivos.
    await Promise.all([...widths.map(w => `${name}-${w}.webp`), cardVariantFile(name)].map(file => rm(join(mediaDir, file), { force: true })));
    const [winner] = await callPg<MediaRow>(sql, 'mediaByHash', [hash]);
    if (!winner) throw new ApiError(403, 'Permiso insuficiente');
    return toPhoto(winner);
  }

  return {
    async upload(access: string | undefined, file: File): Promise<Photo> {
      const actor = await authorization.require(access, PERMISSIONS.mediaUpload);
      if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'La foto supera los 8 MB');
      return store(actor.id_usuario, Buffer.from(await file.arrayBuffer()));
    },

    async videoCover(access: string | undefined, link: string): Promise<Photo> {
      const actor = await authorization.require(access, PERMISSIONS.mediaUpload);
      const source = videoSource(link);
      if (!source) throw new ApiError(422, `Video: ${videoLinkProblem(link)}`);
      const image = await fetchCover(source, MAX_UPLOAD_BYTES).catch(() => null);
      if (!image) throw new ApiError(422, 'No se pudo obtener la imagen de este video. Sube una portada.');
      return store(actor.id_usuario, image);
    },
  };
}
