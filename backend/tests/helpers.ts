import { expect } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import type { Mailer } from "../src/mailer";
import { createSecurity } from "../src/security";

export const PASSWORD = "Ab1!xyz";

/**
 * App real contra la base de pruebas, con correo simulado y cuentas creadas a medida.
 * Con `trustProxyIp`, `call` puede simular la IP del visitante (cabecera X-Real-IP).
 */
export function testApp(mediaDir = "medios-pruebas", trustProxyIp = false) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL debe apuntar a una base de pruebas desechable");
  const sql = new SQL(url);
  const config: Config = {
    databaseUrl: url, origin: "http://localhost:3000",
    jwtSecret: "clave-de-prueba-aleatoria-de-mas-de-32-caracteres",
    googleClientId: "cliente-de-prueba", port: 3000, bindHost: "127.0.0.1",
    trustProxyIp, production: false,
    smtp: { host: "localhost", port: 1025, user: "test", pass: "test", from: "test@example.test", name: "Test" },
    mediaDir,
  };
  const sent: { to: string; subject: string; url: string }[] = [];
  const mailer: Mailer = { async send(to, mensaje) { sent.push({ to, subject: mensaje.asunto, url: mensaje.url }); } };
  const app = createApp({ sql, config, mailer, security: createSecurity(config) });
  const ids: Record<string, number> = {};
  const cookies: Record<string, string> = {};

  async function call(path: string, method = "GET", body?: object | FormData, cookie?: string, ip?: string) {
    const headers = new Headers();
    if (ip) headers.set("x-real-ip", ip);
    if (method !== "GET") headers.set("origin", config.origin);
    if (body && !(body instanceof FormData)) headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    return app.handle(new Request(config.origin + path, {
      method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }));
  }

  /** Crea una cuenta verificada con contraseña y guarda su cookie de acceso. */
  async function account(name: string, rol: string, maestro = false) {
    const hash = await Bun.password.hash(PASSWORD, "argon2id");
    const [row] = await sql`INSERT INTO tb_usuarios (correo, nombres_completos, correo_verificado_en, rol, es_maestro)
      VALUES (${name + "@example.com"}, ${name}, now(), ${rol}, ${maestro}) RETURNING id_usuario`;
    await sql`INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, contrasenia_hash)
      VALUES (${row.id_usuario}, 'correo', ${hash})`;
    ids[name] = row.id_usuario;
    const res = await call("/api/auth/login", "POST", { correo: name + "@example.com", contrasenia: PASSWORD });
    expect(res.status).toBe(200);
    cookies[name] = res.headers.getSetCookie().find(v => v.startsWith("access="))!.split(";")[0];
  }

  /** Deja las tablas de cuentas y los contadores de intentos vacíos para que cada archivo empiece igual. */
  const resetAccounts = () => sql`TRUNCATE tb_auditoria, tb_sesiones, tb_registros_pendientes,
    tb_token_autenticacion, tb_identidades_autenticacion, tb_usuarios, tb_limites_intentos RESTART IDENTITY CASCADE`;

  return { sql, config, app, ids, cookies, sent, call, account, resetAccounts };
}
