import type { ContentRepository } from "../content-repository";
import { citizenLinks, proposals } from "./seed-data";

/** Lee contenido estático de semilla; no consulta ni modifica el backend. */
export class MockContentRepository implements ContentRepository {
  async getProposals() {
    return proposals;
  }

  async getProposal(slug: string) {
    return proposals.find((proposal) => proposal.slug === slug);
  }

  async getCitizenLinks() {
    return citizenLinks;
  }
}
