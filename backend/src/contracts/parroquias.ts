// Lo usan el backend para validar y el frontend para pintar «Mi equipo» y su editor. Cambiar la lista
// cambia la restricción ck_mi_equipo_clave (src/db/schema.ts): hay que generar una migración (bun run db:generate).
export const PARROQUIAS = [
  { slug: 'alto-tambo', nombre: 'Alto Tambo' },
  { slug: 'ancon', nombre: 'Ancón (Pichangal)' },
  { slug: 'calderon', nombre: 'Calderón' },
  { slug: 'carondelet', nombre: 'Carondelet' },
  { slug: '5-de-junio', nombre: '5 de Junio (Uimbí)' },
  { slug: 'concepcion', nombre: 'Concepción' },
  { slug: 'mataje', nombre: 'Mataje (Santander)' },
  { slug: 'san-javier-de-cachavi', nombre: 'San Javier de Cachaví' },
  { slug: 'santa-rita', nombre: 'Santa Rita' },
  { slug: 'tambillo', nombre: 'Tambillo' },
  { slug: 'tululbi', nombre: 'Tululbí (Ricaurte)' },
  { slug: 'urbina', nombre: 'Urbina' },
] as const;

export type ParroquiaSlug = (typeof PARROQUIAS)[number]['slug'];

export const MAX_EQUIPO = 9;
export const MAX_FOTOS_PARROQUIA = 6;
