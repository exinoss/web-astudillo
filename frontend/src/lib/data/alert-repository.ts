import type { AlertInput, Published, SentAlert } from './types';

/** Alertas del votante con sesión; sin sesión las llamadas fallan con ApiError 401. */
export interface AlertRepository {
  submit(input: AlertInput): Promise<SentAlert>;
  mine(): Promise<SentAlert[]>;
  /** Las publicadas, también sin sesión. */
  published(): Promise<{ items: Published<SentAlert>[]; total: number }>;
}
