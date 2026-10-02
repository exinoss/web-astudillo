import type { ImageMetadata } from "astro";

export interface ProposalModel {
  src: string;
  // Importado en la semilla (se optimiza con astro:assets); URL si viene de la API.
  poster: ImageMetadata | string;
  alt: string;
}

/** Foto subida desde el panel: el backend ya generó las variantes `/medios/<nombre>-<ancho>.webp`. */
export interface UploadedPicture {
  nombre: string;
  ancho: number;
  alto: number;
  anchos: number[];
}

/** Recurso del código (lo optimiza astro:assets) o foto subida desde el panel. */
export type Picture = ImageMetadata | UploadedPicture;

export interface Kpi {
  label: string;
  value: string;
}

export interface Proposal {
  slug: string;
  name: string;
  icon: string;
  label: string;
  intro: string;
  kpis: Kpi[];
  model?: ProposalModel;
}

export interface CitizenLink {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

export type AlertType = "agua" | "basura" | "alumbrado" | "baches" | "seguridad" | "otro";
export type ParticipationState = "recibida" | "en_revision" | "atendida";

/** `idempotencia`: UUID creado con el borrador; reenviar el mismo formulario no duplica el envío. */
export interface AlertInput {
  idempotencia: string;
  tipo: AlertType;
  sector: string;
  referencia?: string;
  descripcion: string;
  foto?: File;
}

export interface SentAlert {
  id: number;
  tipo: AlertType;
  sector: string;
  referencia: string | null;
  descripcion: string;
  estado: ParticipationState;
  creadoEn: string;
  /** Rutas privadas de la API: solo las ven su autor y quien revisa la participación. */
  foto: { miniatura: string; grande: string } | null;
}

export interface SuggestionInput {
  idempotencia: string;
  tema: string;
  mensaje: string;
}

export interface SentSuggestion {
  id: number;
  tema: string;
  mensaje: string;
  estado: ParticipationState;
  creadoEn: string;
}

export interface ChatReply {
  text: string;
  linkHref?: string;
  linkText?: string;
}

export interface BiographyMilestone {
  years: string;
  title: string;
  text: string[];
  image: Picture | null;
  alt: string;
}

export interface WorkMilestone {
  name: string;
  done: boolean;
}

export interface WorkEvidence {
  image: Picture;
  alt: string;
  caption: string;
}

/**
 * Obra asociada a una propuesta; `updatedAt` en formato ISO. El porcentaje y la etapa no se
 * guardan: los calcula `src/lib/obras.ts` a partir de los hitos completados.
 */
export interface WorkProgress {
  proposalSlug: string;
  updatedAt: string;
  note: string;
  milestones: WorkMilestone[];
  evidence: WorkEvidence[];
}
