import type { ContentRepository } from "../content-repository";
import { biography, chatQuickReplies, citizenLinks, proposals, works } from "./seed-data";

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

  async getBiography() {
    return biography;
  }

  async getWorks() {
    return works;
  }

  async getTexts() {
    return {};
  }

  async getChatQuickReplies() {
    return chatQuickReplies;
  }
}
