import { randomInt, timingSafeEqual } from "node:crypto";
import type { SQL } from "bun";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";
import type { Mailer } from "../../mailer";
import { MENSAJES } from "../../mail/plantilla";
import { randomToken, tokenHash } from "../../security";
import type { Attempts } from "../types";
import { passwordVerify } from "./limits";

const VIGENCIA_CODIGO = 600;

// Sal propia por código: con solo 6 dígitos, dos códigos iguales darían el mismo hash y chocarían en su índice único.
const cifrar = (codigo: string, sal = randomToken()) => `${sal}.${tokenHash(`${sal}:${codigo}`)}`;
const coincide = (codigo: string, guardado: string) => {
  const calculado = Buffer.from(cifrar(codigo, guardado.split(".")[0]));
  const esperado = Buffer.from(guardado);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
};

export function createConfirmation(sql: SQL, attempts: Attempts, mailer: Mailer) {
  async function metodo(userId: number) {
    const [row] = await callPg<{ correo: string; contrasenia_hash: string | null }>(sql, "confirmationMethod", [userId]);
    if (!row) throw new ApiError(401, "Sesión no válida");
    return row;
  }

  async function codigoValido(userId: number, codigo: string) {
    if (!/^\d{6}$/.test(codigo)) return false;
    const [row] = await callPg<{ token_hash: string }>(sql, "confirmationCode", [userId]);
    return !!row && coincide(codigo, row.token_hash);
  }

  return {
    /** Envía un código a una cuenta sin contraseña; pedirlo otra vez antes de un minuto no manda otro correo. */
    async sendCode(userId: number) {
      const { correo, contrasenia_hash } = await metodo(userId);
      if (contrasenia_hash) throw new ApiError(409, "Confirma con tu contraseña");
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const [creado] = await callPg<{ id_token_autenticacion: number }>(
        sql, "authTokenCreate", [userId, correo, "confirmar_accion", cifrar(codigo), VIGENCIA_CODIGO],
      );
      if (!creado) return;
      try {
        await mailer.send(correo, MENSAJES.codigo(codigo));
      } catch {
        await callPg(sql, "authTokenDelete", [creado.id_token_autenticacion]);
        throw new ApiError(503, "No se pudo enviar el correo");
      }
    },

    /**
     * Exige la contraseña de `userId` o, si no tiene, su código vigente, que sirve para varios cambios hasta vencer.
     * Los fallos comparten el contador del cambio de contraseña: no se suman intentos usando las dos vías.
     */
    async require(userId: number, valor: string, ip: string) {
      const keys = attempts.changeKeys(userId, ip);
      await attempts.check(keys);
      const { contrasenia_hash } = await metodo(userId);
      const valido = contrasenia_hash ? await passwordVerify(valor, contrasenia_hash) : await codigoValido(userId, valor);
      if (!valido) throw (await attempts.fail(keys))
        ?? new ApiError(403, contrasenia_hash ? "La contraseña no es correcta" : "El código no es correcto o ya venció");
      await attempts.clear(keys);
    },
  };
}
