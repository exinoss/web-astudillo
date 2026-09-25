import type { Config } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Define atributos seguros y alcance para las cookies de autenticación. */
export function cookieOptions(config: Config, seconds: number, path: string) {
  return { httpOnly: true, secure: config.production, sameSite: "lax" as const, path, maxAge: seconds };
}

/** Proyecta los campos de cuenta que puede recibir el cliente. */
export const publicAccount = (user: import("./security").Account) => ({
  id: user.id_usuario, correo: user.correo, nombresCompletos: user.nombres_completos,
  direccion: user.direccion, rol: user.rol,
});
