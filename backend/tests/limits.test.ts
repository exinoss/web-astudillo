import { afterAll, beforeAll, expect, test } from "bun:test";
import { migrate } from "../src/db/migrate";
import { PASSWORD, testApp } from "./helpers";

const { sql, sent, call, account, resetAccounts } = testApp("medios-pruebas-limites", true);

const login = (correo: string, contrasenia: string, ip: string) =>
  call("/api/auth/login", "POST", { correo, contrasenia }, undefined, ip);
/** Adelanta el reloj de una clave: su bloqueo ya terminó. */
const expire = (clave: string) =>
  sql`UPDATE tb_limites_intentos SET bloqueado_hasta = now() - interval '1 second' WHERE clave = ${clave}`;
const failuresOf = async (clave: string) =>
  (await sql`SELECT fallos FROM tb_limites_intentos WHERE clave = ${clave}`)[0]?.fallos ?? 0;
/** El enlace de acceso se envía sin esperar la respuesta: se espera a que llegue al doble de correo. */
async function nextMail(before: number) {
  for (let i = 0; i < 50 && sent.length === before; i++) await Bun.sleep(20);
  return sent.at(-1)!;
}

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await account("ana", "votante");
  await account("beto", "votante");
});
afterAll(async () => { await sql.close(); });

test("la espera sube hasta 3 días; solo el bloqueo mortal cierra la IP a otros correos", async () => {
  for (let i = 0; i < 5; i++) expect((await login("ana@example.com", "mala", "10.0.0.1")).status).toBe(401);
  const first = await login("ana@example.com", "mala", "10.0.0.1");
  expect(first.status).toBe(429);
  expect(first.headers.get("retry-after")).toBe("60");
  expect(await first.json()).toMatchObject({ reintentarEn: 60, sugerirRecuperacion: true });

  // Mientras está bloqueado no se calcula el hash ni suma fallos, aunque la contraseña sea buena.
  expect((await login("ana@example.com", PASSWORD, "10.0.0.1")).status).toBe(429);
  expect(await failuresOf("par:ana@example.com|10.0.0.1")).toBe(6);

  // El dueño, desde otra IP, entra; el atacante sigue bloqueado.
  expect((await login("ana@example.com", PASSWORD, "10.0.0.2")).status).toBe(200);
  expect((await login("ana@example.com", "mala", "10.0.0.1")).status).toBe(429);
  // Una espera temporal es solo para esa pareja: desde esa IP otro correo sigue pudiendo entrar.
  expect((await login("beto@example.com", PASSWORD, "10.0.0.1")).status).toBe(200);

  for (const wait of [300, 900, 3600, 21600, 259200]) {
    await expire("par:ana@example.com|10.0.0.1");
    const res = await login("ana@example.com", "mala", "10.0.0.1");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.reintentarEn).toBe(wait);
    expect(body.sugerirRecuperacion).toBeUndefined(); // solo en el primer bloqueo
  }
  // Bloqueo mortal: esa IP ya no puede probar ningún correo, y dura 3 días aunque pasen 24 h.
  expect((await login("beto@example.com", PASSWORD, "10.0.0.1")).status).toBe(429);
  await sql`UPDATE tb_limites_intentos SET ultimo_fallo = now() - interval '25 hours' WHERE clave LIKE '%10.0.0.1'`;
  expect((await login("ana@example.com", PASSWORD, "10.0.0.1")).status).toBe(429);
  expect((await login("beto@example.com", PASSWORD, "10.0.0.1")).status).toBe(429);
  // El dueño sigue entrando desde su IP: con un solo atacante no hace falta enlace.
  expect(await (await login("ana@example.com", PASSWORD, "10.0.0.2")).json()).toHaveProperty("user");
});

test("correos al azar desde una IP la bloquean, y un acierto no limpia la IP", async () => {
  for (let i = 0; i < 20; i++) expect((await login(`azar${i}@example.com`, "mala", "10.0.1.1")).status).toBe(401);
  // Un acierto desde esa IP (cuenta propia del atacante) no reinicia su contador.
  expect((await login("beto@example.com", PASSWORD, "10.0.1.1")).status).toBe(200);
  const blocked = await login("azar99@example.com", "mala", "10.0.1.1");
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).sugerirRecuperacion).toBeUndefined();
  expect((await login("beto@example.com", PASSWORD, "10.0.1.1")).status).toBe(429);
  expect((await login("beto@example.com", PASSWORD, "10.0.1.2")).status).toBe(200);
});

test("fallos simultáneos suman exactamente, y a las 24 h el contador vuelve a cero", async () => {
  await Promise.all(Array.from({ length: 5 }, () => login("beto@example.com", "mala", "10.0.2.1")));
  expect(await failuresOf("par:beto@example.com|10.0.2.1")).toBe(5);
  await sql`UPDATE tb_limites_intentos SET ultimo_fallo = now() - interval '25 hours' WHERE clave = 'par:beto@example.com|10.0.2.1'`;
  expect((await login("beto@example.com", "mala", "10.0.2.1")).status).toBe(401);
  expect(await failuresOf("par:beto@example.com|10.0.2.1")).toBe(1);
});

test("con dos IPs en bloqueo mortal sobre un correo, el dueño entra por enlace sin revelar si la contraseña era buena", async () => {
  // Dos atacantes (dos IPs) llegaron al bloqueo mortal con este correo.
  for (const ip of ["10.0.3.8", "10.0.3.9"]) await sql`INSERT INTO tb_limites_intentos (clave, fallos, bloqueado_hasta, ultimo_fallo)
    VALUES (${"par:beto@example.com|" + ip}, 11, now() + interval '3 days', now())`;
  const before = sent.length;
  const wrong = await login("beto@example.com", "mala", "10.0.3.1");
  const right = await login("beto@example.com", PASSWORD, "10.0.3.2");
  expect(wrong.status).toBe(200);
  expect(right.status).toBe(200);
  expect(await wrong.json()).toEqual(await right.json());
  expect(right.headers.getSetCookie().some(c => c.startsWith("access="))).toBe(false);
  const mail = await nextMail(before);
  expect(sent.length).toBe(before + 1); // solo la contraseña buena envía el enlace
  expect(new URL(mail.url).pathname).toBe("/cuenta/acceso/");

  const token = new URL(mail.url).searchParams.get("token")!;
  const confirmed = await call("/api/auth/login/confirm", "POST", { token });
  expect(confirmed.status).toBe(200);
  expect(confirmed.headers.getSetCookie().some(c => c.startsWith("access="))).toBe(true);
  // El enlace es de un solo uso y, al usarlo, el correo vuelve a la normalidad.
  expect((await call("/api/auth/login/confirm", "POST", { token })).status).toBe(400);
  expect(await failuresOf("par:beto@example.com|10.0.3.8")).toBe(0);
  expect((await login("beto@example.com", PASSWORD, "10.0.3.3")).status).toBe(200);
});

test("restablecer la contraseña por correo levanta el bloqueo, aunque se comparta IP con el atacante", async () => {
  for (let i = 0; i < 6; i++) await login("ana@example.com", "mala", "10.0.4.1");
  expect((await login("ana@example.com", PASSWORD, "10.0.4.1")).status).toBe(429);
  const before = sent.length;
  await call("/api/auth/password/reset-request", "POST", { correo: "ana@example.com" }, undefined, "10.0.4.1");
  expect(sent.length).toBe(before + 1);
  const token = new URL(sent.at(-1)!.url).searchParams.get("token")!;
  const nueva = "Otra clave segura1!";
  expect((await call("/api/auth/password/reset", "POST", { token, contrasenia: nueva })).status).toBe(200);
  expect((await login("ana@example.com", nueva, "10.0.4.1")).status).toBe(200);
});

test("cambiar la contraseña con la actual incorrecta también tiene sanción progresiva", async () => {
  await account("carla", "votante");
  const [cookie] = [(await login("carla@example.com", PASSWORD, "10.0.5.1")).headers.getSetCookie()
    .find(c => c.startsWith("access="))!.split(";")[0]];
  const change = () => call("/api/auth/password/change", "POST",
    { contraseniaActual: "incorrecta1!", contraseniaNueva: "Nueva clave1!", confirmarContrasenia: "Nueva clave1!" }, cookie, "10.0.5.1");
  for (let i = 0; i < 5; i++) expect((await change()).status).toBe(403);
  const blocked = await change();
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).sugerirRecuperacion).toBeUndefined();
});
