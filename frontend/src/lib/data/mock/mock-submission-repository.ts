import type { SubmissionRepository } from "../submission-repository";

const SUCCESS_MESSAGE = "Gracias por compartir tu mensaje. Tu voz cuenta.";

export class MockSubmissionRepository implements SubmissionRepository {
  async submitSuggestion() {
    return { ok: true, message: SUCCESS_MESSAGE };
  }

  async submitAlert() {
    return { ok: true, message: SUCCESS_MESSAGE };
  }
}
