import type { AlertRepository } from '../alert-repository';
import type { AlertInput } from '../types';

/** Simula el envío de alertas mientras no existe endpoint de backend. */
export class MockAlertRepository implements AlertRepository {
  async submit(_input: AlertInput) {
    return { ok: true, message: 'Gracias por compartir tu mensaje. Tu voz cuenta.' };
  }
}
