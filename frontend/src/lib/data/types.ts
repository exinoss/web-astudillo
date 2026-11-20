import type { ImageMetadata } from "astro";
import type { Animacion } from "../comun/animaciones";
import type { PUESTOS } from "../../../../backend/src/contracts/equipo";
import type { Original } from "../../../../backend/src/contracts/inicio";
import type { ParroquiaSlug } from "../../../../backend/src/contracts/parroquias";
import type { EstadoParticipacion, TipoAlerta } from "../../../../backend/src/contracts/participacion";
import type { PaginaCarlos } from "../../../../backend/src/contracts/acerca-de-carlos";

export interface ProposalModel {
  src: string;
  poster: ImageMetadata | string;
  alt: string;
}

export interface ProposalSite {
  url: string;
  title: string;
  description: string;
  logo: ImageMetadata;
  logoAnimado?: Animacion;
}

/** Foto subida desde el panel: el backend ya generó las variantes `/medios/<nombre>-<ancho>.webp`. */
export interface UploadedPicture {
  nombre: string;
  ancho: number;
  alto: number;
  anchos: number[];
}

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
  site?: ProposalSite;
}

export interface CitizenLink {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

export type AlertType = TipoAlerta;
export type ParticipationState = EstadoParticipacion;

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
  /** Rutas de la API: las de una alerta sin publicar solo las ven su autor y quien revisa la participación. */
  foto: { miniatura: string; grande: string } | null;
  publica?: boolean;
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

/** Lo que ve cualquier visitante: `autor` es null si se publicó sin nombre; `mia`, si la envió quien mira. */
export type Published<T> = T & { autor: string | null; mia: boolean };

export interface ChatReply {
  text: string;
  linkHref?: string;
  linkText?: string;
}

export interface BiographyMilestone {
  years: string;
  title: string;
  text: string[];
  image: UploadedPicture | null;
  alt: string;
}

interface WorkMilestone {
  name: string;
  done: boolean;
}

export type WorkEvidence =
  | { image: UploadedPicture; alt: string; caption: string }
  | { video: Pick<AboutCarlosVideo, "url" | "vertical" | "cover">; caption: string };

/**
 * Obra asociada a una propuesta; `updatedAt` en formato ISO. El porcentaje y la etapa no se
 * guardan: los calcula `src/lib/ciudadania/obras.ts` a partir de los hitos completados.
 */
export interface WorkProgress {
  proposalSlug: string;
  updatedAt: string;
  note: string;
  milestones: WorkMilestone[];
  evidence: WorkEvidence[];
}

export type AboutCarlosSlug = PaginaCarlos;
interface AboutCarlosVideo {
  title: string;
  description: string | null;
  url: string;
  vertical: boolean;
  cover: UploadedPicture | null;
}

export interface AboutCarlosPage {
  videos: AboutCarlosVideo[];
  interview: { question: string; answer: string }[];
  gallery: { image: UploadedPicture; alt: string; caption: string }[];
}

export interface TeamMember {
  name: string;
  post: (typeof PUESTOS)[number];
  image: UploadedPicture | null;
  intro: string;
  career: string[];
}

export interface Parish {
  slug: ParroquiaSlug;
  name: string;
  paragraphs: string[];
  photos: { image: UploadedPicture; alt: string }[];
}

export interface MyTeam {
  members: TeamMember[];
  parishes: Parish[];
}

export type HomeImage = { original: Original } | { photo: UploadedPicture };
interface HomeSlideImage { image: HomeImage; alt: string }
export type HomePiece = HomeSlideImage | { video: Omit<AboutCarlosVideo, "description"> };

/** Siempre trae al menos un banner y una pieza; el del equipo puede venir vacío. */
export interface HomeCarousels {
  banners: (HomeSlideImage & { mobile: UploadedPicture | null })[];
  portrait: HomeSlideImage;
  link: string;
  pieces: HomePiece[];
  team: { image: UploadedPicture; alt: string }[];
}
