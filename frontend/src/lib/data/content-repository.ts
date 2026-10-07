import type { BiographyMilestone, AboutCarlosPage, AboutCarlosSlug, CitizenLink, Proposal, WorkProgress } from "./types";

export interface ContentRepository {
  getProposals(): Promise<Proposal[]>;
  getProposal(slug: string): Promise<Proposal | undefined>;
  getCitizenLinks(): Promise<CitizenLink[]>;
  getBiography(): Promise<BiographyMilestone[]>;
  getWorks(): Promise<WorkProgress[]>;
  getTexts(): Promise<Record<string, string>>;
  getInitialTexts(): Promise<Record<string, string>>;
  /** Preguntas del chat marcadas como respuesta rápida, en orden. */
  getChatQuickReplies(): Promise<string[]>;
  getAboutCarlosPage(slug: AboutCarlosSlug): Promise<AboutCarlosPage>;
}
