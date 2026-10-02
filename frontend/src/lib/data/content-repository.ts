import type { BiographyMilestone, CitizenLink, Proposal, WorkProgress } from "./types";

export interface ContentRepository {
  getProposals(): Promise<Proposal[]>;
  getProposal(slug: string): Promise<Proposal | undefined>;
  getCitizenLinks(): Promise<CitizenLink[]>;
  getBiography(): Promise<BiographyMilestone[]>;
  getWorks(): Promise<WorkProgress[]>;
  /** Textos del sitio cambiados desde el panel; lo que no esté aquí usa el valor de `lib/contenido.ts`. */
  getTexts(): Promise<Record<string, string>>;
  /** Preguntas del chat marcadas como respuesta rápida, en orden. */
  getChatQuickReplies(): Promise<string[]>;
}
