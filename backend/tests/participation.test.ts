import { afterAll, beforeAll, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import sharp from "sharp";
import { migrate } from "../src/db/migrate";
import { testApp } from "./helpers";

const MEDIA = "medios-pruebas-participacion";
const { sql, cookies, call, account, resetAccounts } = testApp(MEDIA);

/** JPG con orientación y GPS en EXIF: la copia guardada no debe conservar ninguno de los dos. */
const photo = (w = 900, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: "#f47f0e" } })
  .jpeg().withExif({ IFD0: { Make: "Prueba" }, IFD3: { GPSLatitudeRef: "N" } }).toBuffer();

function alertForm(fields: Record<string, string>, foto?: Buffer | Uint8Array, name = "foto.jpg") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (foto) form.append("foto", new File([new Uint8Array(foto)], name));
  return form;
}
const alert = (extra: Record<string, string> = {}) => ({
  idempotencia: crypto.randomUUID(), tipo: "baches", sector: "Barrio Central",
  descripcion: "Hay un bache grande en la esquina", ...extra,
});

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await sql`TRUNCATE tb_alertas, tb_sugerencias, tb_chat_respuestas, tb_chat_sin_respuesta, tb_publicaciones RESTART IDENTITY CASCADE`;
  await migrate(sql); // vuelve a cargar las preguntas iniciales del chat, que solo se insertan con la tabla vacía
  await account("admin", "admin");
  await account("analista", "analista");
  await account("votante", "votante");
  await account("otro", "votante");
});
afterAll(async () => {
  await rm(`${MEDIA}-privados`, { recursive: true, force: true }).catch(() => {});
  await sql.close();
});

test("sin sesión no se envían alertas, sugerencias ni consultas", async () => {
  expect((await call("/api/participacion/alertas", "POST", alertForm(alert()))).status).toBe(401);
  expect((await call("/api/participacion/sugerencias", "POST",
    { idempotencia: crypto.randomUUID(), tema: "agua-potable", mensaje: "Una idea suficientemente larga" })).status).toBe(401);
  expect((await call("/api/participacion/chat", "POST", { mensaje: "hola" })).status).toBe(401);
});

test("una alerta repetida con la misma clave no se duplica, tampoco a la vez", async () => {
  const fields = alert();
  const foto = await photo();
  const [a, b] = await Promise.all([1, 2].map(() =>
    call("/api/participacion/alertas", "POST", alertForm(fields, foto), cookies.votante)));
  expect([a.status, b.status]).toEqual([200, 200]);
  const [first, second] = [await a.json(), await b.json()];
  expect(first.id).toBe(second.id);
  expect(first).toMatchObject({ tipo: "baches", estado: "recibida" });
  expect(first.foto.miniatura).toMatch(/^\/api\/participacion\/fotos\/a[0-9a-f]{40}-480\.webp$/);
  const again = await call("/api/participacion/alertas", "POST", alertForm(fields), cookies.votante);
  expect((await again.json()).id).toBe(first.id);
  const [{ total }] = await sql`SELECT count(*)::int AS total FROM tb_alertas`;
  expect(total).toBe(1);
});

test("la foto es privada, sin metadatos, y solo la ven su autor y quien revisa", async () => {
  const [{ alertas: [mine] }] = [await (await call("/api/participacion/alertas/mias", "GET", undefined, cookies.votante)).json()];
  const url = mine.foto.miniatura;
  const own = await call(url, "GET", undefined, cookies.votante);
  expect(own.status).toBe(200);
  const meta = await sharp(Buffer.from(await own.arrayBuffer())).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect((await call(url, "GET", undefined, cookies.analista)).status).toBe(200);
  expect((await call(url, "GET", undefined, cookies.otro)).status).toBe(404);
  expect((await call(url, "GET")).status).toBe(401);
  expect((await call("/api/participacion/fotos/..%2F..%2Fsecreto-480.webp", "GET", undefined, cookies.votante)).status).toBe(404);
});

test("las alertas validan tipo, descripción, tamaño y formato de la foto", async () => {
  const send = (form: FormData) => call("/api/participacion/alertas", "POST", form, cookies.otro);
  expect((await send(alertForm(alert({ tipo: "incendio" })))).status).toBe(422);
  expect((await send(alertForm(alert({ descripcion: "corto" })))).status).toBe(422);
  expect((await send(alertForm(alert({ sector: "<b>x</b>" })))).status).toBe(422);
  expect((await send(alertForm(alert(), new Uint8Array(5 * 1024 * 1024 + 1)))).status).toBe(413);
  expect((await send(alertForm(alert(), new TextEncoder().encode("no soy una imagen"), "x.jpg"))).status).toBe(415);
});

test("el historial muestra solo lo propio", async () => {
  const mine = await (await call("/api/participacion/alertas/mias", "GET", undefined, cookies.otro)).json();
  expect(mine.alertas).toEqual([]);
});

test("sugerencias: idempotentes, con tema válido y mínimo de 15 caracteres", async () => {
  const body = { idempotencia: crypto.randomUUID(), tema: "agua-potable", mensaje: "Más pozos en las comunidades" };
  const a = await (await call("/api/participacion/sugerencias", "POST", body, cookies.votante)).json();
  const b = await (await call("/api/participacion/sugerencias", "POST", body, cookies.votante)).json();
  expect(a.id).toBe(b.id);
  expect((await call("/api/participacion/sugerencias", "POST", { ...body, idempotencia: crypto.randomUUID(), mensaje: "corto" }, cookies.votante)).status).toBe(422);
  expect((await call("/api/participacion/sugerencias", "POST", { ...body, idempotencia: crypto.randomUUID(), tema: "Agua Potable" }, cookies.votante)).status).toBe(422);
  const mine = await (await call("/api/participacion/sugerencias/mias", "GET", undefined, cookies.votante)).json();
  expect(mine.sugerencias).toHaveLength(1);
});

test("el panel lista y cambia estados con control de concurrencia", async () => {
  expect((await call("/api/admin/participacion/alertas", "GET", undefined, cookies.votante)).status).toBe(403);
  const list = await (await call("/api/admin/participacion/alertas?estado=recibida", "GET", undefined, cookies.analista)).json();
  expect(list.items).toHaveLength(1);
  expect(list.items[0]).toMatchObject({ autor: "votante", correo: "votante@example.com" });
  expect(list.conteo.alertas.recibida).toBe(1);
  const id = list.items[0].id;
  const change = (estado: string, estadoAnterior: string, who = "admin") =>
    call(`/api/admin/participacion/alertas/${id}/estado`, "PATCH", { estado, estadoAnterior }, cookies[who]);
  expect((await change("en_revision", "recibida", "analista")).status).toBe(403);
  expect((await change("en_revision", "recibida")).status).toBe(200);
  // Repetir el mismo cambio es seguro; otro admin con la lista vieja recibe 409 y no pisa.
  expect((await change("en_revision", "recibida")).status).toBe(200);
  expect((await change("atendida", "recibida")).status).toBe(409);
  expect((await change("atendida", "en_revision")).status).toBe(200);
  const mine = await (await call("/api/participacion/alertas/mias", "GET", undefined, cookies.votante)).json();
  expect(mine.alertas[0].estado).toBe("atendida");
  expect((await call("/api/admin/participacion/alertas/9999/estado", "PATCH", { estado: "atendida", estadoAnterior: "recibida" }, cookies.admin)).status).toBe(404);
});

test("demasiados envíos seguidos responden 429 con la espera", async () => {
  let last: Response | undefined;
  for (let i = 0; i < 6; i++) last = await call("/api/participacion/alertas", "POST", alertForm(alert()), cookies.analista);
  expect(last!.status).toBe(429);
  expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
});

test("el chat responde con lo publicado y anota lo que no sabe", async () => {
  const ask = async (mensaje: string) => (await (await call("/api/participacion/chat", "POST", { mensaje }, cookies.otro)).json());
  // Sin publicación todavía: no hay respuestas y todo queda anotado.
  expect((await ask("¿Dónde están las PROPUESTAS?")).enlaceRuta).toBe("/#contacto");
  const pub = await call("/api/admin/publicaciones", "POST", undefined, cookies.admin);
  expect(pub.status).toBe(200);
  await sql`UPDATE tb_publicaciones SET estado = 'publicada'`; // lo que haría el publicador
  expect(await ask("¿Dónde están las PROPUESTAS?")).toMatchObject({ enlaceRuta: "/#propuestas" });
  expect(await ask("como reporto un dano en mi barrio")).toMatchObject({ enlaceRuta: "/ciudadania/alerta-ciudadana/" });
  await ask("¿Cuándo hay caravana?");
  await ask("cuando hay caravana");
  const rows = await (await call("/api/admin/chat/sin-respuesta", "GET", undefined, cookies.admin)).json();
  expect(rows.preguntas.find((p: { clave: string }) => p.clave === "cuando hay caravana")?.veces).toBe(2);
  expect((await call("/api/admin/chat/sin-respuesta", "GET", undefined, cookies.votante)).status).toBe(403);
});

test("las preguntas frecuentes se guardan con versión y solo enlazan dentro del sitio", async () => {
  const draft = async () => (await (await call("/api/admin/contenido", "GET", undefined, cookies.admin)).json());
  const { chat, versiones } = await draft();
  expect(chat).toHaveLength(4);
  const save = (respuestas: unknown[], version: string) =>
    call("/api/admin/contenido/chat", "PUT", { respuestas, version }, cookies.admin);
  const next = [...chat, { pregunta: "Voluntariado", palabrasClave: "voluntario, ayudar", respuesta: "Escríbenos.",
    enlaceTexto: null, enlaceRuta: null, destacada: false }];
  expect((await save(next, versiones.chat)).status).toBe(200);
  expect((await save(next, versiones.chat)).status).toBe(200); // repetir: sin cambios
  expect((await save(chat, versiones.chat)).status).toBe(409); // versión vieja con otro contenido
  const fresh = (await draft()).versiones.chat;
  const bad = (enlaceRuta: string) => save([{ ...chat[0], enlaceRuta }], fresh);
  expect((await bad("https://malo.example")).status).toBe(422);
  expect((await bad("//malo.example")).status).toBe(422);
  expect((await bad("javascript:alert(1)")).status).toBe(422);
});

test("los enlaces de redes solo aceptan su dominio y WhatsApp se guarda como número", async () => {
  const put = async (clave: string, valor: string) => {
    const { versiones } = await (await call("/api/admin/contenido", "GET", undefined, cookies.admin)).json();
    return call(`/api/admin/contenido/textos/${clave}`, "PUT", { valor, version: versiones.textos[clave] ?? null }, cookies.admin);
  };
  expect((await put("enlace.facebook", "javascript:alert(1)")).status).toBe(422);
  expect((await put("enlace.facebook", "https://facebook.com.malo.example/x")).status).toBe(422);
  expect((await put("enlace.tiktok", "http://www.tiktok.com/@carlos")).status).toBe(422);
  expect((await put("enlace.facebook", "https://www.facebook.com/carlosastudillo7")).status).toBe(200);
  expect((await put("enlace.otra", "https://example.com")).status).toBe(422);
  expect((await put("enlace.whatsapp", "098 565 8595")).status).toBe(200);
  const [{ valor }] = await sql`SELECT valor FROM tb_textos WHERE clave = 'enlace.whatsapp'`;
  expect(valor).toBe("593985658595");
  expect((await put("enlace.whatsapp", "+593 95 856 5874")).status).toBe(200);
  expect((await put("enlace.whatsapp", "llámame")).status).toBe(422);
});
