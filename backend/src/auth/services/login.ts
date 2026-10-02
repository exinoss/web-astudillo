import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { AuthTokenRow, PasswordUserRow, UserRow } from "../../db/types";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import { MENSAJES } from "../../mail/plantilla";
import { normalizeEmail, randomToken, tokenHash } from "../../security";
import type { Attempts, Sessions } from "../types";
import { passwordVerify } from "./limits";

const dummyHash = Bun.password.hash("contraseña-de-comparación-no-válida", "argon2id");
const LINK_SECONDS = 900;

export function createLogin(sql: SQL, sessions: Sessions, attempts: Attempts, mailer: Mailer, config: Config) {
  /** Envía el enlace de acceso; si ya salió uno hace un momento no manda otro (fn_auth_token_create). */
  async function sendLink(user: PasswordUserRow, correo: string) {
    const token = randomToken();
    const [created] = await callPg<{ id_token_autenticacion: number }>(sql, "authTokenCreate",
      [user.id_usuario, correo, "acceso_correo", tokenHash(token), LINK_SECONDS]);
    if (!created) return;
    try {
      await mailer.send(correo, MENSAJES.acceso(`${config.origin}/cuenta/acceso/?token=${encodeURIComponent(token)}`));
    } catch (error) {
      await callPg(sql, "authTokenDelete", [created.id_token_autenticacion]);
      throw error;
    }
  }

  return {
    /**
     * Comprueba los bloqueos antes del hash, verifica la contraseña y suma o limpia fallos.
     * Si el correo sufrió muchos fallos desde IPs distintas, responde `{ link: true }` con contraseña
     * buena o mala (el atacante no aprende nada) y solo con la buena envía el enlace de acceso.
     */
    async login(correoInput: string, password: string, ip: string) {
      const correo = normalizeEmail(correoInput);
      const keys = attempts.loginKeys(correo, ip);
      const { emailLink } = await attempts.check(keys, true);
      const [user] = await callPg<PasswordUserRow>(sql, "passwordUser", [correo]);
      const valid = await passwordVerify(password, user?.contrasenia_hash ?? await dummyHash);
      const ok = !!user && valid && user.estado === "activo";
      if (emailLink) {
        // Sin esperar el envío: la respuesta tarda lo mismo con contraseña buena o mala.
        if (ok) void sendLink(user, correo).catch(error => console.error("No se pudo enviar el enlace de acceso", error?.code ?? error));
        else await attempts.fail(keys);
        return { link: true as const };
      }
      if (!ok) throw (await attempts.fail(keys, true)) ?? new ApiError(401, "Credenciales no válidas");
      await attempts.clear(keys);
      return { user, tokens: await sessions.start(user) };
    },

    /** Consume el enlace de acceso e inicia sesión; demuestra control del correo y limpia sus contadores. */
    async confirm(token: string) {
      const user = await sql.begin(async tx => {
        const [row] = await callPg<AuthTokenRow>(tx, "authTokenGet", [tokenHash(token), "acceso_correo"]);
        if (!row || row.consumido_en || new Date(row.expira_en) <= new Date() || row.id_usuario === null)
          throw new ApiError(400, "Enlace inválido o vencido");
        const [account] = await callPg<UserRow>(tx, "activeUser", [row.id_usuario]);
        if (!account) throw new ApiError(400, "Enlace inválido o vencido");
        await callPg(tx, "authTokenConsume", [row.id_token_autenticacion]);
        return account;
      });
      await attempts.clearEmail(normalizeEmail(user.correo));
      return { user, tokens: await sessions.start(user) };
    },
  };
}
