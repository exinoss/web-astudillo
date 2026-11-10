import type { SQL } from "bun";
import type { Config } from "../../config";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import type { Mensaje } from "../../mail/plantilla";

/** Enlace de una página de la cuenta con el token en la consulta. */
export const accountLink = (config: Config, path: string, token: string) =>
  `${config.origin}${path}?token=${encodeURIComponent(token)}`;

/** Indica si el token existe, no se usó y no venció. */
export const usableToken = <T extends { consumido_en: string | null; expira_en: string }>(row: T | undefined): row is T =>
  !!row && !row.consumido_en && new Date(row.expira_en) > new Date();

/** Envía el correo de un token; si falla, borra el token para que se pueda pedir otro y responde 503. */
export async function sendTokenMail(sql: SQL, mailer: Mailer, tokenId: number, correo: string, mensaje: Mensaje) {
  try {
    await mailer.send(correo, mensaje);
  } catch (error) {
    await callPg(sql, "authTokenDelete", [tokenId]);
    console.error("No se pudo enviar el correo", (error as { code?: string })?.code ?? error);
    throw new ApiError(503, "No se pudo enviar el correo");
  }
}
