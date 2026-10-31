// Cambiar CARRUSELES cambia la restricción ck_inicio_carruseles_clave (src/db/schema.ts): hay que generar una migración.
export const CARRUSELES = ['principal', 'piezas'] as const;
export type Carrusel = (typeof CARRUSELES)[number];

export const MAX_BANNERS = 5;
export const MAX_PIEZAS = 8;

/** Imágenes que vienen con el sitio (frontend/src/lib/inicio/originales.ts): la semilla y el modo edición las nombran por su clave. */
export const ORIGINALES = ['portada', 'pieza-respeto', 'pieza-ferrocarril', 'pieza-tululbi'] as const;
export type Original = (typeof ORIGINALES)[number];
