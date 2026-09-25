import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import { migrate } from "../src/db/migrate";
import { ApiError } from "../src/http";
import type { Mailer } from "../src/mailer";
import { createSecurity, tokenHash } from "../src/security";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL debe apuntar a una base de pruebas desechable");
const sql = new SQL(url);
const config: Config = {
  databaseUrl: url, origin: "http://localhost:3000",
  jwtSecret: "clave-de-prueba-aleatoria-de-mas-de-32-caracteres",
  googleClientId: "cliente-de-prueba", port: 3000, bindHost: "127.0.0.1",
  trustProxyIp: false, production: false,
  smtp: { host: "localhost", port: 1025, user: "test", pass: "test", from: "test@example.test", name: "Test" },
};
const sent: Array<{ to: string; url: string }> = [];
const mailer: Mailer = { async send(to, _subject, link) { sent.push({ to, url: link }); } };
const original = createSecurity(config);
const security = {
  ...original,
  async verifyGoogle(credential: string, recent = false) {
    if (credential === "antiguo".repeat(20)) {
      if (recent) throw new ApiError(401, "Identidad de Google no válida");
      return { sub: "google-nuevo", email: "nuevo@gmail.com", verified: true,
        hostedDomain: null, name: "Nuevo Google" };
    }
    if (credential === "gmail".repeat(20)) return {
      sub: "google-ana", email: "ana@gmail.com", verified: true, hostedDomain: null, name: "Ana Google",
    };
    if (credential === "nuevo".repeat(20)) return {
      sub: "google-nuevo", email: "nuevo@gmail.com", verified: true, hostedDomain: null, name: "Nuevo Google",
    };
    if (credential === "externo".repeat(20)) return {
      sub: "google-externo", email: "externo@hotmail.com", verified: true, hostedDomain: null, name: "Externo",
    };
    if (credential === "localext".repeat(20)) return {
      sub: "google-local-ext", email: "local@hotmail.com", verified: true, hostedDomain: null, name: "Local",
    };
    if (credential === "bloqueado".repeat(12)) return {
      sub: "google-bloqueado", email: "bloqueado@gmail.com", verified: true, hostedDomain: null, name: "Bloqueado",
    };
    if (credential === "crossdevice".repeat(10)) return {
      sub: "google-cross-device", email: "cross@example.com", verified: true, hostedDomain: null, name: "Cross",
    };
    throw new Error("Credencial Google de prueba inválida");
  },
};
const app = createApp({ sql, config, mailer, security });

function cookieFrom(res: Response, name: string) {
  return res.headers.getSetCookie().find(value => value.startsWith(name + "="))?.split(";")[0];
}
async function call(path: string, method = "GET", body?: object, cookies: string[] = []) {
  const headers = new Headers();
  if (method !== "GET") headers.set("origin", config.origin);
  if (body) headers.set("content-type", "application/json");
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  return app.handle(new Request(config.origin + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  }));
}
function linkToken() {
  const last = sent.at(-1);
  if (!last) throw new Error("No se envió correo");
  return new URL(last.url).searchParams.get("token")!;
}
beforeAll(async () => {
  await migrate(sql);
  await migrate(sql);
  await sql`TRUNCATE tb_auditoria, tb_sesiones, tb_registros_pendientes,
    tb_token_autenticacion, tb_identidades_autenticacion, tb_usuarios RESTART IDENTITY CASCADE`;
});
afterAll(async () => { await sql.close(); });

test("registro, perfil, Google, sesiones y recuperación", async () => {
  const registration = await call("/api/auth/register", "POST", {
    nombresCompletos: "Ana", correo: "Ana@Gmail.com",
    contrasenia: "una contraseña suficientemente larga1!",
    confirmarContrasenia: "una contraseña suficientemente larga1!",
  });
  expect(registration.status).toBe(200);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios`)[0].n).toBe(0);
  expect((await call("/api/auth/login", "POST", {
    correo: "ana@gmail.com", contrasenia: "una contraseña suficientemente larga1!",
  })).status).toBe(401);
  const verificationToken = linkToken();
  expect(new URL(sent.at(-1)!.url).pathname).toBe('/cuenta/verificar/');
  const oldLink = await call("/api/auth/verify-email?token=" + verificationToken);
  expect(oldLink.status).toBe(303);
  expect(new URL(oldLink.headers.get('location')!).pathname).toBe('/cuenta/verificar/');
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios`)[0].n).toBe(0);
  const regCookie = cookieFrom(registration, "registration")!;
  const verified = await call("/api/auth/verify-email", "POST", { token: verificationToken }, [regCookie]);
  expect(verified.status).toBe(200);
  const clearedRegistration = verified.headers.getSetCookie().find(value => value.startsWith('registration='))!;
  expect(clearedRegistration).toContain('Path=/api/auth/verify-email');
  expect(clearedRegistration).toContain('Max-Age=0');
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios`)[0].n).toBe(1);
  expect((await sql`SELECT count(*)::int AS n FROM tb_registros_pendientes`)[0].n).toBe(0);
  expect((await call("/api/auth/verify-email", "POST", { token: verificationToken }, [regCookie])).status).toBe(400);

  const login = await call("/api/auth/login", "POST", {
    correo: "ana@gmail.com", contrasenia: "una contraseña suficientemente larga1!",
  });
  expect(login.status).toBe(200);
  const access = cookieFrom(login, "access")!, refresh = cookieFrom(login, "refresh")!;
  expect((await call("/api/me")).status).toBe(401);
  const account = await call("/api/me", "GET", undefined, [access]);
  expect(account.status).toBe(200);
  expect(await account.json()).toMatchObject({ tieneContrasenia: true, tieneGoogle: false });
  await sql`DELETE FROM tb_rol_permisos rp USING tb_roles r, tb_permisos p
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
      AND r.rol = 'votante' AND p.codigo IN ('perfil.ver', 'perfil.editar')`;
  try {
    expect((await call("/api/me", "GET", undefined, [access])).status).toBe(403);
    expect((await call("/api/me", "PATCH", { nombresCompletos: "Sin permiso" }, [access])).status).toBe(403);
  } finally {
    await sql`INSERT INTO tb_rol_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso FROM tb_roles r CROSS JOIN tb_permisos p
      WHERE r.rol = 'votante' AND p.codigo IN ('perfil.ver', 'perfil.editar')
      ON CONFLICT DO NOTHING`;
  }
  expect((await call("/api/me", "PATCH", {
    nombresCompletos: "Ana Nueva", direccion: "Centro", rol: "admin",
  }, [access])).status).toBe(422);
  const profile = await call("/api/me", "PATCH", { nombresCompletos: "Ana Nueva", direccion: "Centro" }, [access]);
  expect((await profile.json()).rol).toBe("votante");

  const gmail = await call("/api/auth/google", "POST", { credential: "gmail".repeat(20) });
  expect(gmail.status).toBe(200);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios`)[0].n).toBe(1);
  expect(await (await call("/api/me", "GET", undefined, [access])).json())
    .toMatchObject({ tieneContrasenia: true, tieneGoogle: true });

  const [session] = await sql`
    SELECT id_sesion FROM tb_sesiones
    WHERE token_hash = ${tokenHash(refresh.slice("refresh=".length))}`;
  expect(session).toBeDefined();
  await sql`UPDATE tb_sesiones SET expira_en = now() + interval '1 day'
    WHERE id_sesion = ${session.id_sesion}`;
  const [beforeRenewal] = await sql`
    SELECT expira_en FROM tb_sesiones WHERE id_sesion = ${session.id_sesion}`;
  const renewed = await call("/api/auth/refresh", "POST", undefined, [refresh]);
  expect(renewed.status).toBe(200);
  expect((await call("/api/auth/refresh", "POST", undefined, [refresh])).status).toBe(401);
  const refresh2 = cookieFrom(renewed, "refresh")!;
  const [rotatedSession] = await sql`
    SELECT token_hash, expira_en, ultimo_uso_en FROM tb_sesiones
    WHERE id_sesion = ${session.id_sesion}`;
  expect(rotatedSession.token_hash).toBe(tokenHash(refresh2.slice("refresh=".length)));
  expect(new Date(rotatedSession.expira_en).getTime())
    .toBeGreaterThan(new Date(beforeRenewal.expira_en).getTime() + 5 * 24 * 60 * 60 * 1000);
  expect(rotatedSession.ultimo_uso_en).not.toBeNull();
  const logout = await call("/api/auth/logout", "POST", undefined, [refresh2]);
  expect(logout.status).toBe(200);
  const clearedRefresh = logout.headers.getSetCookie().find(value => value.startsWith('refresh='))!;
  expect(clearedRefresh).toContain('Path=/api/auth');
  expect(clearedRefresh).toContain('Max-Age=0');
  expect((await call("/api/auth/refresh", "POST", undefined, [refresh2])).status).toBe(401);

  const resetRequest = await call("/api/auth/password/reset-request", "POST", { correo: "ana@gmail.com" });
  expect(resetRequest.status).toBe(200);
  const sessionBeforeReset = await call("/api/auth/login", "POST", {
    correo: "ana@gmail.com", contrasenia: "una contraseña suficientemente larga1!",
  });
  const refreshBeforeReset = cookieFrom(sessionBeforeReset, "refresh")!;
  const resetToken = linkToken();
  expect(new URL(sent.at(-1)!.url).pathname).toBe('/cuenta/restablecer/');
  const resetRedirect = await call('/api/auth/password/reset?token=' + resetToken);
  expect(resetRedirect.status).toBe(303);
  expect(new URL(resetRedirect.headers.get('location')!).pathname).toBe('/cuenta/restablecer/');
  expect((await call("/api/auth/password/reset", "POST", {
    token: resetToken, contrasenia: "otra contraseña suficientemente larga1!",
  })).status).toBe(200);
  expect((await call("/api/auth/password/reset", "POST", {
    token: resetToken, contrasenia: "otra contraseña suficientemente larga1!",
  })).status).toBe(400);
  expect((await call("/api/auth/refresh", "POST", undefined, [refreshBeforeReset])).status).toBe(401);
  expect((await call("/api/auth/login", "POST", {
    correo: "ana@gmail.com", contrasenia: "otra contraseña suficientemente larga1!",
  })).status).toBe(200);
});

test("verificación desde otro navegador y Google externo", async () => {
  const reg = await call("/api/auth/register", "POST", {
    nombresCompletos: "Otro", correo: "otro@example.com",
    contrasenia: "contraseña original muy larga1!",
    confirmarContrasenia: "contraseña original muy larga1!",
  });
  expect(reg.status).toBe(200);
  const token = linkToken();
  expect((await call("/api/auth/verify-email", "POST", {
    token, contrasenia: "contraseña equivocada larga",
  })).status).toBe(403);
  expect((await call("/api/auth/verify-email", "POST", {
    token, contrasenia: "contraseña original muy larga1!",
  })).status).toBe(200);

  const google = await call("/api/auth/google", "POST", { credential: "externo".repeat(20) });
  expect((await google.json()).pending).toBe(true);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = 'externo@hotmail.com'`)[0].n).toBe(0);
  const externalToken = linkToken();
  expect(new URL(sent.at(-1)!.url).pathname).toBe('/cuenta/google/confirmar/');
  const challenge = cookieFrom(google, "googleChallenge")!;
  const oldGoogleLink = await call('/api/auth/google/confirm?token=' + externalToken);
  expect(oldGoogleLink.status).toBe(303);
  expect(new URL(oldGoogleLink.headers.get('location')!).pathname).toBe('/cuenta/google/confirmar/');
  expect(oldGoogleLink.headers.getSetCookie()).toHaveLength(0);
  const confirmedExternal = await call("/api/auth/google/confirm", "POST", { token: externalToken }, [challenge]);
  expect(confirmedExternal.status).toBe(200);
  expect(cookieFrom(confirmedExternal, "access")).toBeTruthy();
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = 'externo@hotmail.com'`)[0].n).toBe(1);
  const googleOnly = await call("/api/auth/google", "POST", { credential: "nuevo".repeat(20) });
  expect(googleOnly.status).toBe(200);
  expect((await call("/api/auth/login", "POST", {
    correo: "nuevo@gmail.com", contrasenia: "alguna contraseña bastante larga",
  })).status).toBe(401);
  const googleAccess = cookieFrom(googleOnly, "access")!;
  expect(await (await call("/api/me", "GET", undefined, [googleAccess])).json())
    .toMatchObject({ tieneContrasenia: false, tieneGoogle: true });
  await sql`DELETE FROM tb_rol_permisos rp USING tb_roles r, tb_permisos p
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
      AND r.rol = 'votante' AND p.codigo = 'cuenta.contrasenia.agregar'`;
  try {
    expect((await call("/api/auth/password", "POST", {
      credential: "nuevo".repeat(20), contrasenia: "nueva contraseña suficientemente larga1!",
    }, [googleAccess])).status).toBe(403);
  } finally {
    await sql`INSERT INTO tb_rol_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso FROM tb_roles r CROSS JOIN tb_permisos p
      WHERE r.rol = 'votante' AND p.codigo = 'cuenta.contrasenia.agregar'
      ON CONFLICT DO NOTHING`;
  }
  expect((await call("/api/auth/password", "POST", {
    credential: "antiguo".repeat(20), contrasenia: "nueva contraseña suficientemente larga1!",
  }, [googleAccess])).status).toBe(401);
  expect((await call("/api/auth/password", "POST", {
    credential: "nuevo".repeat(20), contrasenia: "nueva contraseña suficientemente larga1!",
  }, [googleAccess])).status).toBe(200);
  expect((await call("/api/auth/login", "POST", {
    correo: "nuevo@gmail.com", contrasenia: "nueva contraseña suficientemente larga1!",
  })).status).toBe(200);
  expect(await (await call("/api/me", "GET", undefined, [googleAccess])).json())
    .toMatchObject({ tieneContrasenia: true, tieneGoogle: true });
  expect((await sql`SELECT count(*)::int AS n FROM tb_auditoria
    WHERE accion IN ('cuenta_creada', 'google_vinculado', 'contrasenia_restaurada',
      'contrasenia_agregada', 'perfil_actualizado')`)[0].n).toBeGreaterThanOrEqual(5);
});

test("duplicados simultáneos, vencimiento, vinculación externa y bloqueo", async () => {
  const common = { nombresCompletos: "Carrera", correo: "carrera@example.com" };
  const first = await call("/api/auth/register", "POST", { ...common,
    contrasenia: "primera contraseña muy larga1!", confirmarContrasenia: "primera contraseña muy larga1!" });
  const firstToken = linkToken(), firstCookie = cookieFrom(first, "registration")!;
  const second = await call("/api/auth/register", "POST", { ...common,
    contrasenia: "segunda contraseña muy larga1!", confirmarContrasenia: "segunda contraseña muy larga1!" });
  const secondToken = linkToken(), secondCookie = cookieFrom(second, "registration")!;
  const results = await Promise.all([
    call("/api/auth/verify-email", "POST", { token: firstToken }, [firstCookie]),
    call("/api/auth/verify-email", "POST", { token: secondToken }, [secondCookie]),
  ]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = 'carrera@example.com'`)[0].n).toBe(1);

  const expiring = await call("/api/auth/register", "POST", {
    nombresCompletos: "Vence", correo: "vence@example.com",
    contrasenia: "contraseña que ya venció1!", confirmarContrasenia: "contraseña que ya venció1!",
  });
  const expiredToken = linkToken();
  await sql`UPDATE tb_token_autenticacion
    SET creado_en = now() - interval '2 hours', expira_en = now() - interval '1 hour'
    WHERE token_hash = ${(await import("../src/security")).tokenHash(expiredToken)}`;
  expect((await call("/api/auth/verify-email", "POST", { token: expiredToken },
    [cookieFrom(expiring, "registration")!])).status).toBe(400);

  const local = await call("/api/auth/register", "POST", {
    nombresCompletos: "Local", correo: "local@hotmail.com",
    contrasenia: "contraseña local bastante larga1!",
    confirmarContrasenia: "contraseña local bastante larga1!",
  });
  const localToken = linkToken();
  await call("/api/auth/verify-email", "POST", { token: localToken }, [cookieFrom(local, "registration")!]);
  const google = await call("/api/auth/google", "POST", { credential: "localext".repeat(20) });
  expect((await google.json()).pending).toBe(true);
  const googleToken = linkToken();
  expect((await call("/api/auth/google/confirm", "POST", { token: googleToken },
    [cookieFrom(google, "googleChallenge")!])).status).toBe(200);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = 'local@hotmail.com'`)[0].n).toBe(1);

  const blocked = await call("/api/auth/google", "POST", { credential: "bloqueado".repeat(12) });
  const blockedAccess = cookieFrom(blocked, "access")!, blockedRefresh = cookieFrom(blocked, "refresh")!;
  await sql`UPDATE tb_usuarios SET estado = 'bloqueado' WHERE correo = 'bloqueado@gmail.com'`;
  expect((await call("/api/me", "GET", undefined, [blockedAccess])).status).toBe(401);
  expect((await call("/api/auth/refresh", "POST", undefined, [blockedRefresh])).status).toBe(401);
  expect((await call("/api/auth/google", "POST", { credential: "bloqueado".repeat(12) })).status).toBe(403);
  const winningPassword = results[0].status === 200
    ? "primera contraseña muy larga1!" : "segunda contraseña muy larga1!";
  expect((await call("/api/auth/login", "POST", {
    correo: "carrera@example.com", contrasenia: winningPassword,
  }, [])).status).toBe(200);
  const noOrigin = await app.handle(new Request(config.origin + "/api/auth/logout", { method: "POST" }));
  expect(noOrigin.status).toBe(403);
});

test("Google externo confirmado desde otro navegador exige la misma identidad", async () => {
  const started = await call("/api/auth/google", "POST", { credential: "crossdevice".repeat(10) });
  expect((await started.json()).pending).toBe(true);
  const token = linkToken();
  expect((await call("/api/auth/google/confirm", "POST", { token })).status).toBe(403);
  expect((await call("/api/auth/google/confirm", "POST", {
    token, credential: "gmail".repeat(20),
  })).status).toBe(403);
  const confirmed = await call("/api/auth/google/confirm", "POST", {
    token, credential: "crossdevice".repeat(10),
  });
  expect(confirmed.status).toBe(200);
  expect((await call("/api/auth/google/confirm", "POST", {
    token, credential: "crossdevice".repeat(10),
  })).status).toBe(400);
});

test("política de contraseña, confirmación y cambio de contraseña", async () => {
  expect((await call('/api/auth/register', 'POST', {
    nombresCompletos: 'Corta', correo: 'corta@example.com',
    contrasenia: 'abcdef', confirmarContrasenia: 'abcdef',
  })).status).toBe(422);
  expect((await call('/api/auth/register', 'POST', {
    nombresCompletos: 'Distinta', correo: 'distinta@example.com',
    contrasenia: 'Ab1!xy', confirmarContrasenia: 'Ab1!xz',
  })).status).toBe(422);
  const registration = await call('/api/auth/register', 'POST', {
    nombresCompletos: 'Cambio', correo: 'cambio@example.com',
    contrasenia: 'Ab1!xy', confirmarContrasenia: 'Ab1!xy',
  });
  expect(registration.status).toBe(200);
  const token = linkToken();
  expect((await call('/api/auth/verify-email', 'POST', { token },
    [cookieFrom(registration, 'registration')!])).status).toBe(200);
  const login = await call('/api/auth/login', 'POST', {
    correo: 'cambio@example.com', contrasenia: 'Ab1!xy',
  });
  expect(login.status).toBe(200);
  const access = cookieFrom(login, 'access')!, refresh = cookieFrom(login, 'refresh')!;
  const change = (body: object) => call('/api/auth/password/change', 'POST', body, [access]);
  await sql`DELETE FROM tb_rol_permisos rp USING tb_roles r, tb_permisos p
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
      AND r.rol = 'votante' AND p.codigo = 'cuenta.contrasenia.cambiar'`;
  try {
    expect((await change({ contraseniaActual: 'Ab1!xy', contraseniaNueva: 'Cd2@xy',
      confirmarContrasenia: 'Cd2@xy' })).status).toBe(403);
  } finally {
    await sql`INSERT INTO tb_rol_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso FROM tb_roles r CROSS JOIN tb_permisos p
      WHERE r.rol = 'votante' AND p.codigo = 'cuenta.contrasenia.cambiar'
      ON CONFLICT DO NOTHING`;
  }
  expect((await change({ contraseniaActual: 'Mal1!xy', contraseniaNueva: 'Cd2@xy',
    confirmarContrasenia: 'Cd2@xy' })).status).toBe(403);
  expect((await change({ contraseniaActual: 'Ab1!xy', contraseniaNueva: 'Cd2@xy',
    confirmarContrasenia: 'Cd2@xz' })).status).toBe(422);
  expect((await change({ contraseniaActual: 'Ab1!xy', contraseniaNueva: 'abcdef',
    confirmarContrasenia: 'abcdef' })).status).toBe(422);
  const changed = await change({ contraseniaActual: 'Ab1!xy', contraseniaNueva: 'Cd2@xy',
    confirmarContrasenia: 'Cd2@xy' });
  expect(changed.status).toBe(200);
  expect(changed.headers.getSetCookie().some(value => value.startsWith('access=') && value.includes('Max-Age=0')))
    .toBe(true);
  expect((await call('/api/auth/refresh', 'POST', undefined, [refresh])).status).toBe(401);
  expect((await call('/api/auth/login', 'POST', {
    correo: 'cambio@example.com', contrasenia: 'Ab1!xy',
  })).status).toBe(401);
  expect((await call('/api/auth/login', 'POST', {
    correo: 'cambio@example.com', contrasenia: 'Cd2@xy',
  })).status).toBe(200);
});
