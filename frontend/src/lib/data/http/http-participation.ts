import type { AlertRepository } from '../alert-repository';
import type { ChatRepository } from '../chat-repository';
import type { SuggestionRepository } from '../suggestion-repository';
import type { SentAlert, SentSuggestion } from '../types';
import { apiRequest } from './api-client';

const call = <T>(path: string, method = 'GET', body?: object | FormData) => apiRequest<T>(path, method, body, true);

export const httpAlertRepository: AlertRepository = {
  submit(input) {
    const form = new FormData();
    for (const [key, value] of Object.entries(input))
      if (value !== undefined && value !== '') form.append(key, value as string | File);
    return call<SentAlert>('/api/participacion/alertas', 'POST', form);
  },
  mine: () => call<{ alertas: SentAlert[] }>('/api/participacion/alertas/mias').then((r) => r.alertas),
};

export const httpSuggestionRepository: SuggestionRepository = {
  submit: (input) => call<SentSuggestion>('/api/participacion/sugerencias', 'POST', input),
};

export const httpChatRepository: ChatRepository = {
  ask: (mensaje, idempotencia) => call<{ texto: string; enlaceTexto: string | null; enlaceRuta: string | null }>(
    '/api/participacion/chat', 'POST', { mensaje, idempotencia },
  ).then((r) => ({ text: r.texto, linkHref: r.enlaceRuta ?? undefined, linkText: r.enlaceTexto ?? undefined })),
};
