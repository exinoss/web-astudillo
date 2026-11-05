// Cambiar CARRUSELES cambia la restricción ck_inicio_carruseles_clave (src/db/schema.ts): hay que generar una migración.
export const CARRUSELES = ['principal', 'piezas', 'equipo'] as const;
export type Carrusel = (typeof CARRUSELES)[number];

export const MAX_BANNERS = 5;
export const MAX_PIEZAS = 8;
export const MAX_FOTOS_EQUIPO = 8;
// El carrusel del equipo usa el marco ancho del principal: el panel lo avisa al elegir la foto y el backend lo repite.
export const AVISO_HORIZONTAL = 'En este carrusel solo van imágenes horizontales (más anchas que altas).';

/** Imágenes que vienen con el sitio (frontend/src/lib/inicio/originales.ts): la semilla y el modo edición las nombran por su clave. */
export const ORIGINALES = ['portada', 'pieza-respeto', 'pieza-ferrocarril', 'pieza-tululbi'] as const;
export type Original = (typeof ORIGINALES)[number];
