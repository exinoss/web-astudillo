import { MockAlertRepository } from "./mock/mock-alert-repository";
import { MockChatRepository } from "./mock/mock-chat-repository";
import { FileContentRepository } from "./file/file-content-repository";
import { MockContentRepository } from "./mock/mock-content-repository";
import { MockSuggestionRepository } from "./mock/mock-suggestion-repository";
import type { AlertRepository } from './alert-repository';
import type { ChatRepository } from './chat-repository';
import type { ContentRepository } from './content-repository';
import type { SuggestionRepository } from './suggestion-repository';

// Al publicar, el publicador compila con CONTENT_FILE (el contenido congelado en la base).
// Sin esa variable (desarrollo, pruebas) se usa la semilla del código.
export const contentRepository: ContentRepository = import.meta.env.CONTENT_FILE
  ? new FileContentRepository(import.meta.env.CONTENT_FILE)
  : new MockContentRepository();
export const suggestionRepository: SuggestionRepository = new MockSuggestionRepository();
export const alertRepository: AlertRepository = new MockAlertRepository();
export const chatRepository: ChatRepository = new MockChatRepository();
