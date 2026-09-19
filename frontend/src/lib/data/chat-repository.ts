import type { ChatReply } from "./types";

export interface ChatRepository {
  ask(message: string): Promise<ChatReply>;
}
