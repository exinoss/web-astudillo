import type { CitizenLink, Proposal } from "./types";

export interface ContentRepository {
  getProposals(): Promise<Proposal[]>;
  getProposal(slug: string): Promise<Proposal | undefined>;
  getCitizenLinks(): Promise<CitizenLink[]>;
}
