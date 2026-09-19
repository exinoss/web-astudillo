import type { AlertInput, SubmitResult, SuggestionInput } from "./types";

export interface SubmissionRepository {
  submitSuggestion(input: SuggestionInput): Promise<SubmitResult>;
  submitAlert(input: AlertInput): Promise<SubmitResult>;
}
