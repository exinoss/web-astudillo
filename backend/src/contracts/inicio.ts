import { esRutaDelSitio, MAX_ENLACE_RED, REDES_SOCIALES } from './redes';

// Cambiar CARRUSELES cambia la restricción ck_inicio_carruseles_clave (src/db/schema.ts): hay que generar una migración.
export const CARRUSELES = ['principal', 'piezas', 'equipo'] as const;
export type Carrusel = (typeof CARRUSELES)[number];

export const MAX_BANNERS = 5;
export const MAX_IMAGENES_PIEZAS = 4;
export const MAX_VIDEOS_PIEZAS = 4;
export const AVISO_PIEZAS = `El carrusel de piezas admite hasta ${MAX_IMAGENES_PIEZAS} imágenes y ${MAX_VIDEOS_PIEZAS} videos.`;
export const MAX_FOTOS_EQUIPO = 8;
// El carrusel del equipo usa el marco ancho del principal: el panel lo avisa al elegir la foto y el backend lo repite.
export const AVISO_HORIZONTAL = 'En este carrusel solo van imágenes horizontales (más anchas que altas).';

const HOSTS_BOTON: readonly string[] = [...Object.values(REDES_SOCIALES).flatMap(r => r.hosts), 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
export const AVISO_ENLACE_BOTON = 'Pega un enlace de Facebook, TikTok, Instagram o YouTube que empiece por https://';

/** Enlace del botón de la segunda diapositiva: '' sin enlace, una página del sitio o un https a las redes o YouTube; null si no vale. */
export function enlaceBoton(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return '';
  if (texto.length > MAX_ENLACE_RED) return null;
  if (texto.startsWith('/')) return esRutaDelSitio(texto) ? texto : null;
  let url: URL;
  try { url = new URL(texto); } catch { return null; }
  return url.protocol === 'https:' && HOSTS_BOTON.includes(url.hostname) && !url.username && !url.password ? url.href : null;
}

/** Imágenes que vienen con el sitio (frontend/src/lib/inicio/originales.ts): la semilla y el modo edición las nombran por su clave. */
export const ORIGINALES = ['portada', 'pieza-respeto', 'pieza-ferrocarril', 'pieza-tululbi'] as const;
export type Original = (typeof ORIGINALES)[number];
