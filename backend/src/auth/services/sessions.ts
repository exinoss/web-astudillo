import type { SQL } from "bun";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";
import type { Account, Security } from "../../security/types";
import { randomToken, tokenHash } from "../../security";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

/** Los refresh tokens se guardan solo como hash. */
export function createSessions(sql: SQL, security: Security) {
  return {
    async start(user: Account) {
      const refresh = randomToken();
      await callPg(sql, "sessionCreate", [user.id_usuario, tokenHash(refresh), SEVEN_DAYS]);
      return { access: await security.sign(user), refresh };
    },
    /** Rota el refresh y emite un acceso; si otra pestaña acaba de rotarlo, da solo el acceso y `refresh` va nulo. */
    async renew(refresh: string | undefined) {
      if (!refresh) throw new ApiError(401, "Sesión no válida");
      const next = randomToken();
      const rows = await callPg<Account>(sql, "sessionRotate", [tokenHash(refresh), tokenHash(next), SEVEN_DAYS]);
      if (rows.length) return { access: await security.sign(rows[0]), refresh: next as string | null, user: rows[0] };
      const [recent] = await callPg<Account>(sql, "sessionRecentlyRotated", [tokenHash(refresh)]);
      if (!recent) throw new ApiError(401, "Sesión no válida");
      return { access: await security.sign(recent), refresh: null, user: recent };
    },
    async revoke(refresh: string | undefined) {
      if (refresh) await callPg(sql, "sessionRevoke", [tokenHash(refresh)]);
    },
    lifetime: SEVEN_DAYS,
  };
}
