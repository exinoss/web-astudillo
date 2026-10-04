import type { SQL } from 'bun';
import { TEXTO_ACEPTACION, VERSION_LEGAL, type AceptacionLegal } from '../../contracts/legal';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';

export function requireAcceptance(input: AceptacionLegal) {
  if (input?.aceptada !== true) throw new ApiError(422, 'Marca la casilla para continuar');
  if (input.version !== VERSION_LEGAL) throw new ApiError(409, 'Las condiciones cambiaron. Recarga la página para revisarlas');
}

export async function hasAcceptance(sql: SQL, user: number) {
  const [row] = await callPg<{ aceptado: boolean }>(sql, 'legalAccepted', [user, VERSION_LEGAL]);
  return row?.aceptado === true;
}

export async function acceptTerms(sql: SQL, user: number, input: AceptacionLegal) {
  requireAcceptance(input);
  const [row] = await callPg<{ resultado: string }>(sql, 'legalAccept', [user, VERSION_LEGAL, TEXTO_ACEPTACION]);
  if (!row) throw new ApiError(403, 'No se pudo completar la solicitud');
  if (row.resultado === 'conflicto') throw new ApiError(409, 'Las condiciones cambiaron. Recarga la página para revisarlas');
  return { terminosAceptados: true };
}

export async function requireParticipationAcceptance(sql: SQL, user: number) {
  if (!await hasAcceptance(sql, user)) throw new ApiError(428, 'Confirma tu aceptación para continuar', { requiereAceptacion: true });
}
