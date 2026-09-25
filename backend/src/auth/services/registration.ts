import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { PendingRegistrationRow } from "../../db/types";
import type { RegistrationInput } from '../types';
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import { normalizeEmail, randomToken, tokenHash } from "../../security";
import { requireConfirmation, requireNewPassword } from '../password-policy';

/** Crea solicitudes de registro y su confirmación de correo de un solo uso. */
export function createRegistration(sql: SQL, mailer: Mailer, config: Config) {
  return {
    /** Guarda la solicitud temporal y envía el enlace sin reservar el correo. */
    async request(input: RegistrationInput) {
      requireNewPassword(input.contrasenia);
      requireConfirmation(input.contrasenia, input.confirmarContrasenia);
      const correo = normalizeEmail(input.correo);
      const name = input.nombresCompletos.trim();
      if (!name) throw new ApiError(422, "Nombre requerido");
      await callPg(sql, "cleanupTokens");
      const existing = await callPg(sql, "userByEmail", [correo]);
      if (existing.length) return null;
      const token = randomToken();
      const browser = randomToken();
      const hash = await Bun.password.hash(input.contrasenia, "argon2id");
      const [{ id_token_autenticacion: id }] = await callPg<{ id_token_autenticacion: number }>(
        sql, "pendingCreate", [correo, tokenHash(token), name,
          input.direccion?.trim() || null, hash, tokenHash(browser)],
      );
      const url = `${config.origin}/cuenta/verificar/?token=${encodeURIComponent(token)}`;
      try { await mailer.send(correo, "Verifica tu correo", url); }
      catch {
        await callPg(sql, "authTokenDelete", [id]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
      return browser;
    },
    /** Completa el alta al validar el enlace y navegador o contraseña alternativa. */
    async verify(token: string, browser?: string, password?: string) {
      const hash = tokenHash(token);
      return sql.begin(async tx => {
        const [row] = await callPg<PendingRegistrationRow>(tx, "pendingGet", [hash]);
        if (!row || row.consumido_en || new Date(row.expira_en) <= new Date()) throw new ApiError(400, "Enlace inválido o vencido");
        const sameBrowser = browser && tokenHash(browser) === row.verificador_navegador_hash;
        if (!sameBrowser && (!password || !(await Bun.password.verify(password, row.contrasenia_hash))))
          throw new ApiError(403, "Confirma con la contraseña usada al registrarte");
        const completed = await callPg(tx, "registrationComplete", [row.id_token_autenticacion]);
        if (!completed.length) throw new ApiError(400, "Enlace inválido o vencido");
        return { ok: true };
      });
    },
  };
}
