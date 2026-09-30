import { MockAlertRepository } from "./mock/mock-alert-repository";
import { MockChatRepository } from "./mock/mock-chat-repository";
import { HttpContentRepository } from "./http/http-content-repository";
import { MockContentRepository } from "./mock/mock-content-repository";
import { MockSuggestionRepository } from "./mock/mock-suggestion-repository";
import type { AlertRepository } from './alert-repository';
import type { ChatRepository } from './chat-repository';
import type { ContentRepository } from './content-repository';
import type { SuggestionRepository } from './suggestion-repository';

// El contenido publicado viene del backend. Las pruebas compilan con `--mode test` y usan la
// semilla del código, para no depender de lo que haya en la base.
export const contentRepository: ContentRepository = import.meta.env.MODE === "test"
  ? new MockContentRepository()
  : new HttpContentRepository();
export const suggestionRepository: SuggestionRepository = new MockSuggestionRepository();
export const alertRepository: AlertRepository = new MockAlertRepository();
export const chatRepository: ChatRepository = new MockChatRepository();
