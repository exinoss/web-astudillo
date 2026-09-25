import type { SQL } from "bun";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";
import type { Account, Security } from "../../security/types";
import { randomToken, tokenHash } from "../../security";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

/** Crea sesiones con refresh tokens aleatorios almacenados solo como hash. */
export function createSessions(sql: SQL, security: Security) {
  return {
    /** Persiste el refresh token y emite el JWT inicial de acceso. */
    async start(user: Account) {
      const refresh = randomToken();
      await callPg(sql, "sessionCreate", [user.id_usuario, tokenHash(refresh)]);
      return { access: await security.sign(user), refresh };
    },
    /** Rota el refresh token y emite un JWT para una sesión activa. */
    async renew(refresh: string | undefined) {
      if (!refresh) throw new ApiError(401, "Sesión no válida");
      const next = randomToken();
      const rows = await callPg<Account>(sql, "sessionRotate", [tokenHash(refresh), tokenHash(next)]);
      if (!rows.length) throw new ApiError(401, "Sesión no válida");
      const user = rows[0];
      return { access: await security.sign(user), refresh: next, user };
    },
    /** Revoca en PostgreSQL la sesión asociada al refresh token. */
    async revoke(refresh: string | undefined) {
      if (refresh) await callPg(sql, "sessionRevoke", [tokenHash(refresh)]);
    },
    lifetime: SEVEN_DAYS,
  };
}
