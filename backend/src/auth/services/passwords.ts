import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { AuthTokenRow, PasswordUserRow } from "../../db/types";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import { MENSAJES } from "../../mail/plantilla";
import type { Security } from "../../security/types";
import { normalizeEmail, randomToken, tokenHash } from "../../security";
import type { Attempts } from "../types";
import { requireConfirmation, requireNewPassword } from '../password-policy';
import { passwordHash, passwordVerify } from './limits';

export function createPasswords(sql: SQL, security: Security, attempts: Attempts, mailer: Mailer, config: Config) {
  /** Indica si `password` ya es la contraseña de la cuenta; permite repetir una operación sin error. */
  async function isCurrentPassword(correo: string, password: string) {
    const [user] = await callPg<PasswordUserRow>(sql, "passwordUser", [normalizeEmail(correo)]);
    return !!user && passwordVerify(password, user.contrasenia_hash);
  }

  return {
    /** Envía instrucciones de recuperación sin revelar si existe la cuenta. */
    async requestReset(correoInput: string) {
      const correo = normalizeEmail(correoInput);
      const rows = await callPg<{ id_usuario: number }>(sql, "resetTarget", [correo]);
      if (!rows.length) return;
      const token = randomToken();
      const [created] = await callPg<{ id_token_autenticacion: number }>(
        sql, "authTokenCreate", [rows[0].id_usuario, correo, "recuperar_contrasenia", tokenHash(token), 1800],
      );
      // Ya se envió un enlace hace un momento (doble envío): no se manda otro.
      if (!created) return;
      const id = created.id_token_autenticacion;
      try {
        await mailer.send(correo, MENSAJES.recuperar(`${config.origin}/cuenta/restablecer/?token=${encodeURIComponent(token)}`));
      } catch {
        await callPg(sql, "authTokenDelete", [id]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
    },
    /** Cambia la contraseña y consume el token de recuperación; el dueño demostró controlar el correo. */
    async reset(token: string, password: string) {
      requireNewPassword(password);
      const hash = await passwordHash(password);
      const correo = await sql.begin(async tx => {
        const [row] = await callPg<AuthTokenRow>(tx, "authTokenGet", [tokenHash(token), "recuperar_contrasenia"]);
        // Idempotente: el mismo enlace y la misma contraseña otra vez (doble envío) es un éxito sin cambios.
        if (row?.consumido_en && new Date(row.expira_en) > new Date() && await isCurrentPassword(row.correo, password)) return row.correo;
        if (!row || row.consumido_en || new Date(row.expira_en) <= new Date())
          throw new ApiError(400, "Enlace inválido o vencido");
        const updated = await callPg(tx, "passwordReset", [row.id_usuario, hash]);
        if (!updated.length) throw new ApiError(400, "Enlace inválido o vencido");
        await callPg(tx, "authTokenConsume", [row.id_token_autenticacion]);
        return row.correo;
      });
      // Levanta cualquier bloqueo de ese correo, también si comparte IP con quien atacaba.
      await attempts.clearEmail(normalizeEmail(correo));
    },
    /** Añade contraseña a una cuenta Google tras revalidar su identidad reciente. */
    async addToGoogle(userId: number, correo: string, credential: string, password: string) {
      requireNewPassword(password);
      const identity = await security.verifyGoogle(credential, true);
      const rows = await callPg(sql, "googleIdentityForUser", [userId, identity.sub]);
      if (!rows.length) throw new ApiError(403, "Vuelve a autenticarte con tu cuenta Google");
      const hash = await passwordHash(password);
      const added = await callPg(sql, "passwordAdd", [userId, identity.sub, hash]);
      // Repetir la misma contraseña (doble envío) no es un error; otra distinta sí.
      if (!added.length && !(await isCurrentPassword(correo, password))) throw new ApiError(409, "La cuenta ya tiene contraseña");
    },
    /** Cambia la contraseña existente y revoca las sesiones activas; una actual incorrecta suma fallos. */
    async change(userId: number, current: string, next: string, confirmation: string, ip: string) {
      requireNewPassword(next);
      requireConfirmation(next, confirmation);
      const keys = attempts.changeKeys(userId, ip);
      await attempts.check(keys);
      await sql.begin(async tx => {
        const [identity] = await callPg<{ contrasenia_hash: string }>(tx, 'passwordChangeTarget', [userId]);
        if (!identity) throw new ApiError(409, 'Esta cuenta no tiene contraseña');
        const [currentOk, alreadyNext] = await Promise.all([
          passwordVerify(current, identity.contrasenia_hash), passwordVerify(next, identity.contrasenia_hash),
        ]);
        // Idempotente: si la nueva ya es la vigente, el cambio se aplicó (doble envío): éxito sin tocar nada.
        if (!currentOk && alreadyNext) return;
        if (!currentOk) throw (await attempts.fail(keys)) ?? new ApiError(403, 'La contraseña actual es incorrecta');
        if (alreadyNext) throw new ApiError(422, 'La contraseña nueva debe ser diferente');
        const hash = await passwordHash(next);
        const changed = await callPg(tx, 'passwordChange', [userId, hash]);
        if (!changed.length) throw new ApiError(409, 'No se pudo cambiar la contraseña');
      });
      await attempts.clear(keys);
    },
  };
}
