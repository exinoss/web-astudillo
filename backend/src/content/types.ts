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

/**
 * Contenido completo del sitio. Es lo que se congela al publicar y lo que la compilación
 * del frontend lee de un archivo; cambiar su forma obliga a cambiar `FileContentRepository`.
 */
export interface Snapshot {
  version: 1;
  textos: Record<string, string>;
  propuestas: ProposalContent[];
  biografia: BiographyItem[];
  obras: WorkContent[];
}
