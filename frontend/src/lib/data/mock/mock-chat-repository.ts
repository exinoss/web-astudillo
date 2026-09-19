import type { ChatRepository } from "../chat-repository";
import type { ChatReply } from "../types";

export class MockChatRepository implements ChatRepository {
  async ask(message: string): Promise<ChatReply> {
    const normalized = message.toLocaleLowerCase("es");
    if (normalized.includes("propuesta")) {
      return {
        text: "Puedes explorar los siete ejes para San Lorenzo. ",
        linkHref: "/#propuestas",
        linkText: "Ver propuestas",
      };
    }
    if (normalized.includes("carlos") || normalized.includes("biograf")) {
      return {
        text: "Carlos Astudillo es candidato a alcalde por el PSC, Lista 6. ",
        linkHref: "/acerca-de-nosotros/",
        linkText: "Conoce a Carlos",
      };
    }
    if (normalized.includes("contact") || normalized.includes("whatsapp")) {
      return {
        text: "Puedes encontrar a Carlos en Facebook y TikTok. ",
        linkHref: "/#contacto",
        linkText: "Ver contacto",
      };
    }
    return {
      text: "Puedo orientarte sobre propuestas, Carlos y contacto. Elige uno de esos temas para continuar.",
    };
  }
}
