import type { ContentRepository } from "../content-repository";
import type { CitizenLink, Proposal } from "../types";

export class HttpContentRepository implements ContentRepository {
  constructor(private readonly baseUrl: string) {}

  async getProposals(): Promise<Proposal[]> {
    const res = await fetch(`${this.baseUrl}/api/proposals`);
    return res.json();
  }

  async getProposal(slug: string): Promise<Proposal | undefined> {
    const res = await fetch(`${this.baseUrl}/api/proposals/${slug}`);
    if (!res.ok) return undefined;
    return res.json();
  }

  async getCitizenLinks(): Promise<CitizenLink[]> {
    const res = await fetch(`${this.baseUrl}/api/citizen-links`);
    return res.json();
  }
}
