import type { SentSuggestion, SuggestionInput } from './types';

/** Sugerencias del votante con sesión; sin sesión fallan con ApiError 401. */
export interface SuggestionRepository {
  submit(input: SuggestionInput): Promise<SentSuggestion>;
  mine(): Promise<SentSuggestion[]>;
}
