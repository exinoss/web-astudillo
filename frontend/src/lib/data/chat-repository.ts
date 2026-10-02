import type { ChatReply } from "./types";

/** Responde con las preguntas frecuentes publicadas; requiere sesión (ApiError 401 sin ella). */
export interface ChatRepository {
  ask(message: string): Promise<ChatReply>;
}
