// Los permisos de cada rol están en la base de datos (`database/datains.sql`).

export const ROLES = ['admin', 'coadmin', 'analista', 'votante'] as const;
export type Rol = typeof ROLES[number];
export const NOMBRES_ROL: Record<Rol, string> = { admin: 'Admin', coadmin: 'Coadmin', analista: 'Analista', votante: 'Votante' };

/** Nombre visible de un rol; si no es uno de los conocidos, el propio valor. */
export const nombreRol = (rol: string) => (NOMBRES_ROL as Record<string, string>)[rol] ?? rol;
