import type { Cookie } from "elysia";
import type { Config } from "./config";

/** Datos extra que acompañan al error; `reintentarEn` (segundos) también sale como cabecera Retry-After. */
export type ApiErrorDetail = { reintentarEn?: number; sugerirRecuperacion?: boolean; requiereAceptacion?: boolean };

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: ApiErrorDetail) { super(message); }
}

/** Define atributos seguros y alcance para las cookies de autenticación. */
export function cookieOptions(config: Config, seconds: number, path: string) {
  return { httpOnly: true, secure: config.production, sameSite: "lax" as const, path, maxAge: seconds };
}

/** Borra una cookie con los mismos atributos con que se creó. */
export function clearCookie(cookie: Cookie<unknown>, config: Config, path: string) {
  cookie.set({ value: '', ...cookieOptions(config, 0, path), expires: new Date(0) });
}

/** El JWT de acceso que trae la petición, si lo hay. */
export const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;

/** Proyecta los campos de cuenta que puede recibir el cliente. */
export const publicAccount = (user: import("./security").Account) => ({
  id: user.id_usuario, correo: user.correo, nombresCompletos: user.nombres_completos,
  direccion: user.direccion, rol: user.rol,
});
