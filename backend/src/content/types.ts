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
}
