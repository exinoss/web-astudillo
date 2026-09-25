import type { AlertInput, SubmitResult } from './types';

export interface AlertRepository {
  submit(input: AlertInput): Promise<SubmitResult>;
}
