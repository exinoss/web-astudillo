import type { SubmitResult, SuggestionInput } from './types';

export interface SuggestionRepository {
  submit(input: SuggestionInput): Promise<SubmitResult>;
}
