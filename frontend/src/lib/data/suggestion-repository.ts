import type { Published, SentSuggestion, SuggestionInput } from './types';

/** Sugerencias del votante con sesión; sin sesión fallan con ApiError 401. */
export interface SuggestionRepository {
  submit(input: SuggestionInput): Promise<SentSuggestion>;
  mine(): Promise<SentSuggestion[]>;
  /** Todas las que se ven en el sitio, también sin sesión. */
  published(): Promise<{ items: Published<SentSuggestion>[]; total: number }>;
}
