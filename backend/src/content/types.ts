import type { Carrusel, Original } from '../contracts/inicio';
import type { ParroquiaSlug } from '../contracts/parroquias';

/** Foto subida desde el panel; el sitio arma las URL `/medios/<nombre>-<ancho>.webp`. */
export interface Photo {
  idMedio: number;
  nombre: string;
  ancho: number;
  alto: number;
  anchos: number[];
}

export interface Kpi { etiqueta: string; valor: string }

export interface ProposalContent {
  slug: string;
  nombre: string;
  categoria: string;
  introduccion: string;
  kpis: Kpi[];
}

export interface BiographyItem {
  anios: string;
  titulo: string;
  texto: string;
  foto: Photo | null;
  alt: string | null;
}

export interface WorkContent {
  slug: string;
  nota: string;
  actualizadoEn: string;
  hitos: { nombre: string; completado: boolean }[];
  fotos: (Photo & { pie: string })[];
}

/** Pregunta frecuente del chat. `enlaceRuta` es siempre una ruta del propio sitio. */
export interface ChatAnswer {
  pregunta: string;
  palabrasClave: string;
  respuesta: string;
  enlaceTexto: string | null;
  enlaceRuta: string | null;
  destacada: boolean;
}

export type CardColor = 'rojo' | 'azul';
export const ABOUT_CARLOS_PAGES = ['por-que-quiero-ser-alcalde', 'conoce-mas'] as const;
export type AboutCarlosSlug = (typeof ABOUT_CARLOS_PAGES)[number];

/** `enlace` llega ya normalizado por contracts/video.ts. */
export interface AboutCarlosPageStored {
  tarjetas: { idMedio: number; alt: string; titulo: string; texto: string; color: CardColor; enfoque: { x: number; y: number } }[];
  video: { titulo: string; descripcion: string | null; enlace: string; vertical: boolean; idPortada: number | null } | null;
  retrato: { idMedio: number; alt: string } | null;
  entrevista: { pregunta: string; respuesta: string }[];
  galeria: { idMedio: number; alt: string; pie: string }[];
}

export interface AboutCarlosPage {
  tarjetas: (Omit<AboutCarlosPageStored['tarjetas'][number], 'idMedio'> & { foto: Photo })[];
  video: (Omit<NonNullable<AboutCarlosPageStored['video']>, 'idPortada'> & { portada: Photo | null }) | null;
  retrato: { foto: Photo; alt: string } | null;
  entrevista: AboutCarlosPageStored['entrevista'];
  galeria: (Omit<AboutCarlosPageStored['galeria'][number], 'idMedio'> & { foto: Photo })[];
}

/** Contenido guardado de cada parte de «Mi equipo»: el equipo (clave `equipo`) y cada parroquia (su slug). */
export interface TeamStored { personas: { idMedio: number | null; nombre: string; quien: string | null }[] }
export interface ParishStored { texto: string; fotos: { idMedio: number; alt: string }[] }

/** Siempre trae las doce parroquias, en el orden de contracts/parroquias.ts. */
export interface MyTeam {
  equipo: { nombre: string; quien: string | null; foto: Photo | null }[];
  parroquias: { slug: ParroquiaSlug; texto: string; fotos: { foto: Photo; alt: string }[] }[];
}

export type HomeImageStored = { original: Original } | { idMedio: number };
export type HomeImage = { original: Original } | { foto: Photo };

/** La semilla crea los dos carruseles con las imágenes que vienen con el sitio. */
export interface HomeCarouselsStored {
  principal: { banners: { imagen: HomeImageStored; celular: number | null; alt: string }[]; retrato: { imagen: HomeImageStored; alt: string } };
  piezas: { piezas: { imagen: HomeImageStored; alt: string }[] };
}

export interface HomeCarousels {
  principal: { banners: { imagen: HomeImage; celular: Photo | null; alt: string }[]; retrato: { imagen: HomeImage; alt: string } };
  piezas: { piezas: { imagen: HomeImage; alt: string }[] };
}

/**
 * Versión (md5 del estado) de cada parte editable del borrador. El panel la devuelve al guardar;
 * si no coincide con la actual, otra persona guardó antes y el guardado responde 409.
 * Un texto sin cambiar no aparece en `textos`: su versión es null.
 */
export interface ContentVersions {
  textos: Record<string, string>;
  propuestas: Record<string, string>;
  biografia: string;
  obras: Record<string, string>;
  chat: string;
  acercaDeCarlos: Record<string, string>;
  /** Solo las partes que se guardaron alguna vez: las demás no tienen versión. */
  miEquipo: Record<string, string>;
  inicio: Partial<Record<Carrusel, string>>;
}

/**
 * Contenido completo del sitio. Es lo que se congela al publicar y lo que el frontend lee de
 * GET /api/contenido/publicado; cambiar su forma obliga a cambiar `HttpContentRepository`.
 */
export interface Snapshot {
  version: 1;
  textos: Record<string, string>;
  originales?: Record<string, string>;
  propuestas: ProposalContent[];
  biografia: BiographyItem[];
  obras: WorkContent[];
  /** Ausente en publicaciones anteriores al chat editable. */
  chat?: ChatAnswer[];
  /** Ausente en publicaciones anteriores a las páginas de Carlos. */
  acercaDeCarlos?: Record<string, AboutCarlosPage>;
  /** Ausente en publicaciones anteriores a «Mi equipo». */
  miEquipo?: MyTeam;
  /** Ausente en publicaciones anteriores a los carruseles editables: se usan los de la semilla. */
  inicio?: HomeCarousels;
}
