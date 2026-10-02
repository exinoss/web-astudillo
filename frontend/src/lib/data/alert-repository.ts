import type { AlertInput, SentAlert } from './types';

/** Alertas del votante con sesión; sin sesión las llamadas fallan con ApiError 401. */
export interface AlertRepository {
  submit(input: AlertInput): Promise<SentAlert>;
  mine(): Promise<SentAlert[]>;
}
