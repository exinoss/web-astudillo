import { MockAlertRepository } from "./mock/mock-alert-repository";
import { MockChatRepository } from "./mock/mock-chat-repository";
import { MockContentRepository } from "./mock/mock-content-repository";
import { MockSuggestionRepository } from "./mock/mock-suggestion-repository";
import type { AlertRepository } from './alert-repository';
import type { ChatRepository } from './chat-repository';
import type { ContentRepository } from './content-repository';
import type { SuggestionRepository } from './suggestion-repository';

export const contentRepository: ContentRepository = new MockContentRepository();
export const suggestionRepository: SuggestionRepository = new MockSuggestionRepository();
export const alertRepository: AlertRepository = new MockAlertRepository();
export const chatRepository: ChatRepository = new MockChatRepository();
