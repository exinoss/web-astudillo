import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { PendingRegistrationRow } from "../../db/types";
import type { RegistrationInput } from '../types';
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import { MENSAJES } from "../../mail/plantilla";
import { normalizeEmail, randomToken, tokenHash } from "../../security";
import { requireConfirmation, requireNewPassword } from '../password-policy';
import { passwordHash } from './limits';
import { requireAcceptance } from './consent';
import { TEXTO_ACEPTACION, VERSION_LEGAL } from '../../contracts/legal';

export function createRegistration(sql: SQL, mailer: Mailer, config: Config) {
  return {
    /** Guarda la solicitud temporal y envía el enlace sin reservar el correo; el enlace vale en cualquier navegador. */
    async request(input: RegistrationInput) {
      requireAcceptance(input.aceptacion);
      requireNewPassword(input.contrasenia);
      requireConfirmation(input.contrasenia, input.confirmarContrasenia);
      const correo = normalizeEmail(input.correo);
      const name = input.nombresCompletos.trim();
      if (!name) throw new ApiError(422, "Nombre requerido");
      await callPg(sql, "cleanupTokens");
      const existing = await callPg(sql, "userByEmail", [correo]);
      if (existing.length) return;
      const token = randomToken();
      const hash = await passwordHash(input.contrasenia);
      const [created] = await callPg<{ id_token_autenticacion: number }>(
        sql, "pendingCreate", [correo, tokenHash(token), name, input.direccion?.trim() || null, hash, VERSION_LEGAL, TEXTO_ACEPTACION],
      );
      // Ya hay una solicitud de hace un momento (doble envío): no se crea otra ni se reenvía el correo.
      if (!created) return;
      const id = created.id_token_autenticacion;
      const url = `${config.origin}/cuenta/verificar/?token=${encodeURIComponent(token)}`;
      try { await mailer.send(correo, MENSAJES.verificar(url)); }
      catch {
        await callPg(sql, "authTokenDelete", [id]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
    },
    async verify(token: string) {
      const hash = tokenHash(token);
      return sql.begin(async tx => {
        const [row] = await callPg<PendingRegistrationRow>(tx, "pendingGet", [hash]);
        if (!row || row.consumido_en || new Date(row.expira_en) <= new Date()) {
          // Idempotente: si este enlace ya creó la cuenta, abrirlo otra vez no es un error.
          const [done] = await callPg<{ verificado: boolean }>(tx, "registrationVerified", [hash]);
          if (done?.verificado) return { ok: true };
          throw new ApiError(400, "Enlace inválido o vencido");
        }
        const completed = await callPg(tx, "registrationComplete", [row.id_token_autenticacion]);
        if (!completed.length) throw new ApiError(400, "Enlace inválido o vencido");
        return { ok: true };
      });
    },
  };
}
