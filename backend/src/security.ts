import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { Config } from "./config";
import type {
  Account as AccountType, GoogleIdentity as GoogleIdentityType, Security as SecurityContract,
} from "./security/types";
import { ApiError } from "./http";

export const randomToken = () => randomBytes(32).toString("base64url");
/** Huella SHA-256 en hexadecimal. */
export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const tokenHash = sha256;
export const PREVIEW_SECONDS = 2 * 60 * 60;
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export type { Account, GoogleIdentity, Security } from './security/types';

export function createSecurity(config: Config): SecurityContract {
  const key = new TextEncoder().encode(config.jwtSecret);
  const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

  /** Valida un JWT propio de esa audiencia y devuelve el ID del usuario o null. */
  async function verifyHs(value: string | undefined, audience: string): Promise<number | null> {
    if (!value) return null;
    try {
      const { payload } = await jwtVerify(value, key, { issuer: config.origin, audience, algorithms: ["HS256"] });
      const id = Number(payload.sub);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch { return null; }
  }

  return {
    /** Emite un JWT de acceso firmado y limitado a diez minutos. */
    async sign(user: AccountType) {
      return new SignJWT({ rol: user.rol }).setProtectedHeader({ alg: "HS256" })
        .setIssuer(config.origin).setAudience("astudillo-api")
        .setSubject(String(user.id_usuario)).setIssuedAt().setExpirationTime("10m").sign(key);
    },
    /** Valida el JWT de acceso y devuelve el ID del usuario o null. */
    verifyAccess: (value: string | undefined) => verifyHs(value, "astudillo-api"),
    /** Pase de la vista previa: lo comprueba nginx en cada página, donde no llega la cookie de acceso. */
    async signPreview(userId: number) {
      return new SignJWT({}).setProtectedHeader({ alg: "HS256" })
        .setIssuer(config.origin).setAudience("astudillo-vista-previa")
        .setSubject(String(userId)).setIssuedAt().setExpirationTime(`${PREVIEW_SECONDS}s`).sign(key);
    },
    verifyPreview: (value: string | undefined) => verifyHs(value, "astudillo-vista-previa"),
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
