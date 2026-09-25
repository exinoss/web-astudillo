import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { Config } from "./config";
import type {
  Account as AccountType, GoogleIdentity as GoogleIdentityType, Security as SecurityContract,
} from "./security/types";
import { ApiError } from "./http";

export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export type { Account, GoogleIdentity, Security } from './security/types';

/** Crea las operaciones JWT de acceso y verificación de credenciales Google. */
export function createSecurity(config: Config): SecurityContract {
  const key = new TextEncoder().encode(config.jwtSecret);
  const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  return {
    /** Emite un JWT de acceso firmado y limitado a diez minutos. */
    async sign(user: AccountType) {
      return new SignJWT({ rol: user.rol }).setProtectedHeader({ alg: "HS256" })
        .setIssuer(config.origin).setAudience("astudillo-api")
        .setSubject(String(user.id_usuario)).setIssuedAt().setExpirationTime("10m").sign(key);
    },
    /** Valida el JWT de acceso y devuelve el ID del usuario o null. */
    async verifyAccess(value: string | undefined): Promise<number | null> {
      if (!value) return null;
      try {
        const { payload } = await jwtVerify(value, key, { issuer: config.origin, audience: "astudillo-api", algorithms: ["HS256"] });
        const id = Number(payload.sub);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      } catch { return null; }
    },
    /** Verifica firma, audiencia y vigencia del ID token de Google. */
    async verifyGoogle(credential: string, recent = false) {
      try {
        const { payload } = await jwtVerify(credential, googleKeys, {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: config.googleClientId, algorithms: ["RS256"],
          ...(recent ? { maxTokenAge: "5m" } : {}),
        });
        if (typeof payload.sub !== "string" || typeof payload.email !== "string" || !payload.email)
          throw new Error("Google sin identidad");
        return {
          sub: payload.sub, email: normalizeEmail(payload.email),
          verified: payload.email_verified === true,
          hostedDomain: typeof payload.hd === "string" ? payload.hd : null,
          name: typeof payload.name === "string" ? payload.name : null,
        } satisfies GoogleIdentityType;
      } catch { throw new ApiError(401, "Identidad de Google no válida"); }
    },
  };
}
