export const PAGINAS_CARLOS = { 'por-que-quiero-ser-alcalde': 'Por qué quiero ser alcalde', 'conoce-mas': 'Conoce más sobre mí' } as const;
export type PaginaCarlos = keyof typeof PAGINAS_CARLOS;
export const SLUGS_CARLOS = Object.keys(PAGINAS_CARLOS) as PaginaCarlos[];

/** Videos de una página; las publicaciones anteriores a los videos múltiples traen uno solo en `video`. */
export const videosDePagina = <V>(page: { videos?: V[]; video?: V | null } | undefined): V[] => page?.videos ?? (page?.video ? [page.video] : []);
