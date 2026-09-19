import type { SubmissionRepository } from "../submission-repository";
import type { AlertInput, SubmitResult, SuggestionInput } from "../types";

export class HttpSubmissionRepository implements SubmissionRepository {
  constructor(private readonly baseUrl: string) {}

  async submitSuggestion(input: SuggestionInput): Promise<SubmitResult> {
    const res = await fetch(`${this.baseUrl}/api/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.json();
  }

  async submitAlert(input: AlertInput): Promise<SubmitResult> {
    const form = new FormData();
    if (input.nombre) form.set("nombre", input.nombre);
    form.set("sector", input.sector);
    if (input.referencia) form.set("referencia", input.referencia);
    form.set("descripcion", input.descripcion);
    if (input.foto) form.set("foto", input.foto);
    const res = await fetch(`${this.baseUrl}/api/alerts`, {
      method: "POST",
      body: form,
    });
    return res.json();
  }
}
