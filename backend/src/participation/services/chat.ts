import type { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization, Limiter } from '../../auth/types';
import type { Content } from '../../content/services/content';
import type { ChatAnswer } from '../../content/types';
import { callPg } from '../../db/call';
import { plainText } from '../../validation/texto';
import { ApiError } from '../../http';
import { requireParticipationAcceptance } from '../../auth/services/consent';
import { VERSION_LEGAL } from '../../contracts/legal';
import { compartirEnCurso } from './en-curso';

const MESSAGES_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60_000;
const FALLBACK = {
  texto: 'Todavía no tengo una respuesta para eso. Anotamos tu pregunta para que el equipo la responda; mientras tanto puedes escribirnos por los canales de contacto.',
  enlaceTexto: 'Ir a contacto', enlaceRuta: '/#contacto',
};
const CONFLICT = 'No se pudo enviar la consulta. Recarga la página e inténtalo de nuevo';
type ChatResponse = { texto: string; enlaceTexto: string | null; enlaceRuta: string | null };

/** Minúsculas, sin tildes y solo letras y números separados por un espacio. */
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Respuesta cuyas palabras clave más aparecen en la pregunta; gana la que coincide con el texto de un botón rápido. */
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
  const sending = compartirEnCurso<ChatResponse>();
  return {
    async ask(access: string | undefined, message: string, idempotency: string) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      await requireParticipationAcceptance(sql, user.id_usuario);
      const question = plainText(message, 'Consulta', 300);
      const hash = createHash('sha256').update(question).digest('hex');
      return sending(`${user.id_usuario}:${idempotency}:${hash}`, async () => {
        const [sent] = await callPg<{ mensaje_hash: string; respuesta: ChatResponse }>(sql, 'chatByKey', [user.id_usuario, idempotency]);
        if (sent && sent.mensaje_hash !== hash) throw new ApiError(409, CONFLICT);
        if (sent) return sent.respuesta;
        limit(`chat:${user.id_usuario}`, MESSAGES_PER_WINDOW, WINDOW_MS);
        const published = await content.current().then(s => s.chat ?? [], () => []);
        const answer = bestAnswer(question, published);
        const response = answer
          ? { texto: answer.respuesta, enlaceTexto: answer.enlaceTexto, enlaceRuta: answer.enlaceRuta }
          : FALLBACK;
        const [saved] = await callPg<{ resultado: string; respuesta: ChatResponse }>(sql, 'chatSend', [
          user.id_usuario, idempotency, hash, response,
          answer ? null : normalize(question).slice(0, 300) || null, question, VERSION_LEGAL,
        ]);
        if (!saved) throw new ApiError(403, 'Permiso insuficiente');
        if (saved.resultado === 'conflicto') throw new ApiError(409, CONFLICT);
        return saved.respuesta;
      });
    },
  };
}
