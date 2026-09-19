export interface Proposal {
  slug: string;
  name: string;
  icon: string;
  label: string;
  intro: string;
}

export interface CitizenLink {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

export interface SuggestionInput {
  nombre?: string;
  tema: string;
  mensaje: string;
}

export interface AlertInput {
  nombre?: string;
  sector: string;
  referencia?: string;
  descripcion: string;
  foto?: File;
}

export interface SubmitResult {
  ok: boolean;
  message: string;
}

export interface ChatReply {
  text: string;
  linkHref?: string;
  linkText?: string;
}
