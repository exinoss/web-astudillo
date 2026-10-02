import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization, Limiter } from '../../auth/types';
import type { Content } from '../../content/services/content';
import type { ChatAnswer } from '../../content/types';
import { callPg } from '../../db/call';
import { plainText } from '../../content/services/validation';

const MESSAGES_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60_000;
const FALLBACK = {
  texto: 'Todavía no tengo una respuesta para eso. Anotamos tu pregunta para que el equipo la responda; mientras tanto puedes escribirnos por los canales de contacto.',
  enlaceTexto: 'Ir a contacto', enlaceRuta: '/#contacto',
};

/** Minúsculas, sin tildes y solo letras y números separados por un espacio. */
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Elige la respuesta cuyas palabras clave más aparecen en la pregunta. Una palabra clave de 4 letras
 * o más también vale como raíz («propuesta» encuentra «propuestas»). Si la pregunta coincide con el
 * texto de una respuesta (los botones de respuesta rápida lo envían tal cual), esa gana.
 */
export function bestAnswer(question: string, answers: ChatAnswer[]) {
  const text = normalize(question);
  const words = text.split(' ');
  const exact = answers.find(a => normalize(a.pregunta) === text);
  if (exact) return exact;
  let best: ChatAnswer | null = null;
  let bestScore = 0;
  for (const answer of answers) {
    const score = answer.palabrasClave.split(',').map(normalize).filter(Boolean).filter(key =>
      key.includes(' ') ? ` ${text} `.includes(` ${key} `)
        : words.some(w => w === key || (key.length >= 4 && w.startsWith(key)))).length;
    if (score > bestScore) { best = answer; bestScore = score; }
  }
  return best;
}

export function createChat(sql: SQL, authorization: Authorization, limit: Limiter, content: Content) {
  return {
    async ask(access: string | undefined, message: string) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      limit(`chat:${user.id_usuario}`, MESSAGES_PER_WINDOW, WINDOW_MS);
      const question = plainText(message, 'Consulta', 300);
      const published = await content.current().then(s => s.chat ?? [], () => []);
      const answer = bestAnswer(question, published);
      if (answer) return { texto: answer.respuesta, enlaceTexto: answer.enlaceTexto, enlaceRuta: answer.enlaceRuta };
      const key = normalize(question).slice(0, 300);
      if (key) await callPg(sql, 'chatUnansweredNote', [key, question.slice(0, 300)]);
      return FALLBACK;
    },
  };
}
