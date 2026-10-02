import { HttpContentRepository } from "./http/http-content-repository";
import { httpAlertRepository, httpChatRepository, httpSuggestionRepository } from "./http/http-participation";
import { MockContentRepository } from "./mock/mock-content-repository";
import type { AlertRepository } from './alert-repository';
import type { ChatRepository } from './chat-repository';
import type { ContentRepository } from './content-repository';
import type { SuggestionRepository } from './suggestion-repository';

// El contenido publicado viene del backend. Las pruebas compilan con `--mode test` y usan la
// semilla del código, para no depender de lo que haya en la base.
export const contentRepository: ContentRepository = import.meta.env.MODE === "test"
  ? new MockContentRepository()
  : new HttpContentRepository();
// Lo que envían los votantes va siempre a la API (en las pruebas, Playwright la simula).
export const suggestionRepository: SuggestionRepository = httpSuggestionRepository;
export const alertRepository: AlertRepository = httpAlertRepository;
export const chatRepository: ChatRepository = httpChatRepository;
