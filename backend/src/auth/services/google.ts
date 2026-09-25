import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import type { AuthTokenRow } from "../../db/types";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import type { Account, Security } from "../../security/types";
import { randomToken, tokenHash } from "../../security";
import type { Sessions } from "../types";
import type { GoogleIdentity } from '../../security/types';

/** Determina si Google prueba directamente la propiedad del correo. */
function isAuthoritative(identity: GoogleIdentity) {
  return identity.verified && (
    identity.email.endsWith("@gmail.com") ||
    !!identity.hostedDomain && identity.email.endsWith(`@${identity.hostedDomain.toLowerCase()}`)
  );
}

/** Crea el acceso Google, la vinculación de identidades y su confirmación. */
export function createGoogleAuth(sql: SQL, security: Security, sessions: Sessions, mailer: Mailer, config: Config) {
  /** Vincula un sub verificado al usuario del mismo correo dentro de una transacción. */
  async function link(identity: GoogleIdentity) {
    return sql.begin(async tx => {
      let rows = await callPg<Account>(tx, "userByEmailLocked", [identity.email]);
      if (!rows.length) {
        rows = await callPg<Account>(tx, "googleUserCreate", [identity.email, identity.name]);
        if (!rows.length) rows = await callPg<Account>(tx, "userByEmailLocked", [identity.email]);
      }
      const user = rows[0];
      if (user.estado !== "activo") throw new ApiError(403, "Cuenta no disponible");
      await callPg(tx, "googleIdentityAdd", [user.id_usuario, identity.sub]);
      const linked = await callPg<{ id_usuario: number }>(tx, "googleIdentityOwner", [identity.sub]);
      if (linked[0]?.id_usuario !== user.id_usuario) throw new ApiError(409, "Identidad de Google ya vinculada");
      return user;
    });
  }

  return {
    /** Inicia sesión por sub o solicita confirmación adicional del correo. */
    async login(credential: string) {
      const identity = await security.verifyGoogle(credential);
      const linked = await callPg<Account>(sql, "googleUser", [identity.sub]);
      if (linked.length) {
        const user = linked[0];
        if (user.estado !== "activo") throw new ApiError(403, "Cuenta no disponible");
        return { user, tokens: await sessions.start(user) };
      }
      if (isAuthoritative(identity)) {
        const user = await link(identity);
        return { user, tokens: await sessions.start(user) };
      }
      const existing = await callPg<Account>(sql, "userByEmail", [identity.email]);
      const token = randomToken(), browser = randomToken();
      const purpose = existing.length ? "vincular_google" : "registro_google";
      const [{ id_token_autenticacion: id }] = await callPg<{ id_token_autenticacion: number }>(
        sql, "authTokenCreate", [existing[0]?.id_usuario ?? null, identity.email, purpose,
          identity.sub, tokenHash(token), tokenHash(browser), 900],
      );
      try {
        await mailer.send(identity.email, "Confirma tu correo para entrar con Google",
          `${config.origin}/cuenta/google/confirmar/?token=${encodeURIComponent(token)}`);
      } catch {
        await callPg(sql, "authTokenDelete", [id]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
      return { pending: true as const, browser };
    },
    /** Consume la confirmación Google y crea o vincula una sola identidad. */
    async confirm(token: string, browser?: string, credential?: string) {
      const hash = tokenHash(token);
      const [row] = await callPg<AuthTokenRow>(sql, "googleTokenGet", [hash]);
      if (!row || row.consumido_en || new Date(row.expira_en) <= new Date()) throw new ApiError(400, "Enlace inválido o vencido");
      if (!browser || tokenHash(browser) !== row.verificador_navegador_hash) {
        if (!credential) throw new ApiError(403, "Vuelve a iniciar sesión con Google");
        const again = await security.verifyGoogle(credential, true);
        if (again.sub !== row.sujeto_externo || again.email !== row.correo)
          throw new ApiError(403, "Identidad de Google diferente");
      }
      const user = await sql.begin(async tx => {
        const [locked] = await callPg<AuthTokenRow>(tx, "googleTokenGet", [hash]);
        if (!locked || locked.consumido_en || new Date(locked.expira_en) <= new Date())
          throw new ApiError(400, "Enlace inválido o vencido");
        let users = await callPg<Account>(tx, "userByEmailLocked", [row.correo]);
        if (!users.length) {
          users = await callPg<Account>(tx, "googleUserCreate", [row.correo, null]);
          if (!users.length) users = await callPg<Account>(tx, "userByEmailLocked", [row.correo]);
        }
        const account = users[0];
        if (account.estado !== "activo") throw new ApiError(403, "Cuenta no disponible");
        await callPg(tx, "googleIdentityAdd", [account.id_usuario, row.sujeto_externo]);
        const linked = await callPg<{ id_usuario: number }>(tx, "googleIdentityOwner", [row.sujeto_externo]);
        if (linked[0]?.id_usuario !== account.id_usuario) throw new ApiError(409, "Identidad de Google ya vinculada");
        await callPg(tx, "authTokenConsume", [row.id_token_autenticacion]);
        return account;
      });
      return { user, tokens: await sessions.start(user) };
    },
  };
}
