import type { SQL } from "bun";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";
import type { Account, Security } from "../../security/types";
import type { Sessions } from "../types";
import type { GoogleIdentity } from '../../security/types';
import { TEXTO_ACEPTACION, VERSION_LEGAL, type AceptacionLegal } from '../../contracts/legal';
import { requireAcceptance } from './consent';
import { plainText } from '../../content/services/validation';

/** El nombre lo escribe la persona en Google: si no es texto plano válido, la cuenta se crea sin nombre. */
function safeName(name: string | null) {
  try { return name ? plainText(name, 'Nombre completo', 200) : null; } catch { return null; }
}

/** Google solo garantiza el correo si es suyo: Gmail o el dominio de Google Workspace de la cuenta. */
function isGoogleMailbox(identity: GoogleIdentity) {
  return identity.verified && (
    identity.email.endsWith("@gmail.com") ||
    !!identity.hostedDomain && identity.email.endsWith(`@${identity.hostedDomain.toLowerCase()}`)
  );
}

export function createGoogleAuth(sql: SQL, security: Security, sessions: Sessions) {
  /** Vincula un sub verificado al usuario del mismo correo dentro de una transacción. */
  async function link(identity: GoogleIdentity, acceptance?: AceptacionLegal) {
    return sql.begin(async tx => {
      let rows = await callPg<Account>(tx, "userByEmailLocked", [identity.email]);
      if (!rows.length) {
        if (!acceptance) return null;
        rows = await callPg<Account>(tx, "googleUserCreate", [identity.email, safeName(identity.name), VERSION_LEGAL, TEXTO_ACEPTACION]);
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
    /**
     * Inicia sesión por sub o, si es la primera vez, crea o vincula la cuenta del mismo correo.
     * Con un correo que no es de Google (una cuenta de Google hecha con Outlook, por ejemplo) no se
     * puede entrar con Google: se pide usar correo y contraseña.
     */
    async login(credential: string, acceptance?: AceptacionLegal) {
      if (acceptance) requireAcceptance(acceptance);
      const identity = await security.verifyGoogle(credential);
      const [linked] = await callPg<Account>(sql, "googleUser", [identity.sub]);
      if (!linked && !isGoogleMailbox(identity)) throw new ApiError(422, "Con Google solo puedes entrar si tu correo es de Gmail. Entra con tu correo y contraseña.");
      const user = linked ?? await link(identity, acceptance);
      if (!user) return { requiereAceptacion: true as const, correo: identity.email, nombresCompletos: safeName(identity.name) };
      if (user.estado !== "activo") throw new ApiError(403, "Cuenta no disponible");
      return { user, tokens: await sessions.start(user) };
    },
  };
}
