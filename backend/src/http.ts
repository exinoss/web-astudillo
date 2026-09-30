import type { Config } from "./config";

/** Datos extra que acompañan al error; `reintentarEn` (segundos) también sale como cabecera Retry-After. */
export type ApiErrorDetail = { reintentarEn?: number; sugerirRecuperacion?: boolean };

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: ApiErrorDetail) { super(message); }
}

/** Define atributos seguros y alcance para las cookies de autenticación. */
export function cookieOptions(config: Config, seconds: number, path: string) {
  return { httpOnly: true, secure: config.production, sameSite: "lax" as const, path, maxAge: seconds };
}

/** Proyecta los campos de cuenta que puede recibir el cliente. */
export const publicAccount = (user: import("./security").Account) => ({
  id: user.id_usuario, correo: user.correo, nombresCompletos: user.nombres_completos,
  direccion: user.direccion, rol: user.rol, esMaestro: user.es_maestro,
});
