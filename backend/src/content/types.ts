import type { Puesto } from '../contracts/equipo';
import type { Carrusel, Original } from '../contracts/inicio';
import type { ParroquiaSlug } from '../contracts/parroquias';
import { SLUGS_CARLOS, type PaginaCarlos } from '../contracts/acerca-de-carlos';

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

export const ABOUT_CARLOS_PAGES = SLUGS_CARLOS;
export type AboutCarlosSlug = PaginaCarlos;

/** `enlace` llega ya normalizado por contracts/video.ts. */
export type VideoStored = { titulo: string; descripcion: string | null; enlace: string; vertical: boolean; idPortada: number | null };

export interface AboutCarlosPageStored {
  videos: VideoStored[];
  entrevista: { pregunta: string; respuesta: string }[];
  galeria: { idMedio: number; alt: string; pie: string }[];
}

export interface AboutCarlosPage {
  videos: (Omit<VideoStored, 'idPortada'> & { portada: Photo | null })[];
  entrevista: AboutCarlosPageStored['entrevista'];
  galeria: (Omit<AboutCarlosPageStored['galeria'][number], 'idMedio'> & { foto: Photo })[];
}

/** Contenido guardado de cada parte de «Mi equipo»: el equipo (clave `equipo`) y cada parroquia (su slug). */
/** Una persona por puesto, en el orden de contracts/equipo.ts. La presentación y la trayectoria son solo del prefecto. */
export interface TeamMemberStored { idMedio: number | null; puesto: Puesto; nombre: string; presentacion: string; trayectoria: string[] }
export interface TeamStored { personas: TeamMemberStored[] }
export interface ParishStored { texto: string; fotos: { idMedio: number; alt: string }[] }

/** Siempre trae las doce parroquias, en el orden de contracts/parroquias.ts. */
export interface MyTeam {
  equipo: (Omit<TeamMemberStored, 'idMedio'> & { foto: Photo | null })[];
  parroquias: { slug: ParroquiaSlug; texto: string; fotos: { foto: Photo; alt: string }[] }[];
}

export type HomeImageStored = { original: Original } | { idMedio: number };
export type HomeImage = { original: Original } | { foto: Photo };
export type HomeVideoStored = Omit<VideoStored, 'descripcion'>;
export type HomePieceStored = { imagen: HomeImageStored; alt: string } | { video: HomeVideoStored };
export type HomePiece = { imagen: HomeImage; alt: string } | { video: Omit<HomeVideoStored, 'idPortada'> & { portada: Photo | null } };

/** La semilla crea el principal y el de piezas con las imágenes que vienen con el sitio; el del equipo empieza vacío. */
export interface HomeCarouselsStored {
  principal: { banners: { imagen: HomeImageStored; celular: number | null; alt: string }[]; retrato: { imagen: HomeImageStored; alt: string }; enlace?: string };
  piezas: { piezas: HomePieceStored[] };
  equipo: { fotos: { idMedio: number; alt: string }[] };
}

export interface HomeCarousels {
  principal: { banners: { imagen: HomeImage; celular: Photo | null; alt: string }[]; retrato: { imagen: HomeImage; alt: string }; enlace: string };
  piezas: { piezas: HomePiece[] };
  equipo: { fotos: { foto: Photo; alt: string }[] };
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
  chat?: ChatAnswer[];
  acercaDeCarlos?: Record<string, AboutCarlosPage>;
  miEquipo?: MyTeam;
  inicio?: HomeCarousels;
}
