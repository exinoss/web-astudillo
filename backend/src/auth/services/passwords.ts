import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { AuthTokenRow, PasswordUserRow } from "../../db/types";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import type { Security } from "../../security/types";
import { normalizeEmail, randomToken, tokenHash } from "../../security";
import type { Sessions } from "../types";
import { requireConfirmation, requireNewPassword } from '../password-policy';

const dummyHash = Bun.password.hash("contraseña-de-comparación-no-válida", "argon2id");

/** Crea los flujos de acceso, recuperación y administración de contraseñas. */
export function createPasswords(sql: SQL, security: Security, sessions: Sessions, mailer: Mailer, config: Config) {
  return {
    /** Verifica correo y hash Argon2id antes de iniciar una sesión. */
    async login(correoInput: string, password: string) {
      const correo = normalizeEmail(correoInput);
      const [user] = await callPg<PasswordUserRow>(sql, "passwordUser", [correo]);
      const valid = await Bun.password.verify(password, user?.contrasenia_hash ?? await dummyHash);
      if (!user || !valid || user.estado !== "activo") throw new ApiError(401, "Credenciales no válidas");
      return { user, tokens: await sessions.start(user) };
    },
    /** Envía instrucciones de recuperación sin revelar si existe la cuenta. */
    async requestReset(correoInput: string) {
      const correo = normalizeEmail(correoInput);
      const rows = await callPg<{ id_usuario: number }>(sql, "resetTarget", [correo]);
      if (!rows.length) return;
      const token = randomToken();
      const [{ id_token_autenticacion: id }] = await callPg<{ id_token_autenticacion: number }>(
        sql, "authTokenCreate", [rows[0].id_usuario, correo, "recuperar_contrasenia",
          null, tokenHash(token), null, 1800],
      );
      try {
        await mailer.send(correo, "Recupera tu contraseña",
          `${config.origin}/cuenta/restablecer/?token=${encodeURIComponent(token)}`);
      } catch {
        await callPg(sql, "authTokenDelete", [id]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
    },
    /** Cambia la contraseña y consume el token de recuperación en una transacción. */
    async reset(token: string, password: string) {
      requireNewPassword(password);
      const hash = await Bun.password.hash(password, "argon2id");
      await sql.begin(async tx => {
        const [row] = await callPg<AuthTokenRow>(tx, "authTokenGet", [tokenHash(token), "recuperar_contrasenia"]);
        if (!row || row.consumido_en || new Date(row.expira_en) <= new Date())
          throw new ApiError(400, "Enlace inválido o vencido");
        const updated = await callPg(tx, "passwordReset", [row.id_usuario, hash]);
        if (!updated.length) throw new ApiError(400, "Enlace inválido o vencido");
        await callPg(tx, "authTokenConsume", [row.id_token_autenticacion]);
      });
    },
    /** Añade contraseña a una cuenta Google tras revalidar su identidad reciente. */
    async addToGoogle(userId: number, credential: string, password: string) {
      requireNewPassword(password);
      const identity = await security.verifyGoogle(credential, true);
      const rows = await callPg(sql, "googleIdentityForUser", [userId, identity.sub]);
      if (!rows.length) throw new ApiError(403, "Vuelve a autenticarte con tu cuenta Google");
      const hash = await Bun.password.hash(password, "argon2id");
      const added = await callPg(sql, "passwordAdd", [userId, identity.sub, hash]);
      if (!added.length) throw new ApiError(409, "La cuenta ya tiene contraseña");
    },
    /** Cambia la contraseña existente y revoca las sesiones activas. */
    async change(userId: number, current: string, next: string, confirmation: string) {
      requireNewPassword(next);
      requireConfirmation(next, confirmation);
      await sql.begin(async tx => {
        const [identity] = await callPg<{ contrasenia_hash: string }>(tx, 'passwordChangeTarget', [userId]);
        if (!identity) throw new ApiError(409, 'Esta cuenta no tiene contraseña');
        if (!(await Bun.password.verify(current, identity.contrasenia_hash)))
          throw new ApiError(403, 'La contraseña actual es incorrecta');
        if (await Bun.password.verify(next, identity.contrasenia_hash))
          throw new ApiError(422, 'La contraseña nueva debe ser diferente');
        const hash = await Bun.password.hash(next, 'argon2id');
        const changed = await callPg(tx, 'passwordChange', [userId, hash]);
        if (!changed.length) throw new ApiError(409, 'No se pudo cambiar la contraseña');
      });
    },
  };
}
