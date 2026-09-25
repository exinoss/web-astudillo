import type { SuggestionRepository } from '../suggestion-repository';
import type { SuggestionInput } from '../types';

/** Simula el envío de sugerencias mientras no existe endpoint de backend. */
export class MockSuggestionRepository implements SuggestionRepository {
  async submit(_input: SuggestionInput) {
    return { ok: true, message: 'Gracias por compartir tu mensaje. Tu voz cuenta.' };
  }
}
