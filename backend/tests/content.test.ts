import { afterAll, beforeAll, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { callPg } from "../src/db/call";
import { migrate } from "../src/db/migrate";
import { testApp } from "./helpers";

const MEDIA = "medios-pruebas-contenido";
const { sql, cookies, call, account, resetAccounts } = testApp(MEDIA);

const png = (w = 1200, h = 800) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#063176" } }).png().toBuffer();
async function upload(buffer: Buffer | Uint8Array, name = "foto.png", who = "coadmin") {
  const form = new FormData();
  form.append("foto", new File([new Uint8Array(buffer)], name));
  return call("/api/admin/medios", "POST", form, cookies[who]);
}

beforeAll(async () => {
  await migrate(sql);
  // Primero las cuentas: su TRUNCATE en cascada también vacía el contenido que las referencia.
  await resetAccounts();
  await sql`TRUNCATE tb_publicaciones, tb_textos, tb_obra_fotos, tb_obra_hitos, tb_obras,
    tb_biografia_hitos, tb_propuesta_kpis, tb_propuestas, tb_medios RESTART IDENTITY CASCADE`;
  await migrate(sql); // vuelve a cargar el contenido inicial, que solo se inserta con tablas vacías
  await account("admin", "admin");
  await account("coadmin", "coadmin");
  await account("votante", "votante");
});
afterAll(async () => {
  // En Windows la carpeta puede seguir en uso un instante; queda ignorada por git.
  await rm(MEDIA, { recursive: true, force: true }).catch(() => {});
  await sql.close();
});

test("el contenido inicial viene de la semilla y solo lo leen quienes editan", async () => {
  expect((await call("/api/admin/contenido", "GET", undefined, cookies.votante)).status).toBe(403);
  const res = await call("/api/admin/contenido", "GET", undefined, cookies.coadmin);
  expect(res.status).toBe(200);
  const c = await res.json();
  expect(c.propuestas).toHaveLength(7);
  expect(c.propuestas[0]).toMatchObject({ slug: "agua-potable", kpis: [
    { etiqueta: "Cobertura meta", valor: "98%" }, { etiqueta: "Comunidades", valor: "32" }, { etiqueta: "Plazo", valor: "36 meses" },
  ] });
  expect(c.biografia).toHaveLength(6);
  expect(c.obras[0].hitos).toHaveLength(5);
  expect(c.textos).toEqual({});
});

test("los textos se guardan como texto plano y vuelven al valor por defecto con null", async () => {
  const put = (clave: string, valor: string | null, who = "coadmin") =>
    call(`/api/admin/contenido/textos/${clave}`, "PUT", { valor }, cookies[who]);
  expect((await put("inicio.cita", "«Por ti, San Lorenzo»")).status).toBe(200);
  expect((await put("inicio.cita", "<img src=x onerror=alert(1)>")).status).toBe(422);
  expect((await put("inicio.cita", "texto​escondido")).status).toBe(422);
  expect((await put("Inicio Cita", "x")).status).toBe(422);
  expect((await put("inicio.cita", "x", "votante")).status).toBe(403);
  let c = await (await call("/api/admin/contenido", "GET", undefined, cookies.coadmin)).json();
  expect(c.textos["inicio.cita"]).toBe("«Por ti, San Lorenzo»");
  expect((await put("inicio.cita", null)).status).toBe(200);
  c = await (await call("/api/admin/contenido", "GET", undefined, cookies.coadmin)).json();
  expect(c.textos).toEqual({});
});

test("propuestas y cifras se guardan juntas", async () => {
  const body = { nombre: "Agua potable", categoria: "Servicios básicos", introduccion: "Agua para todos.",
    kpis: [{ etiqueta: "Comunidades", valor: "34" }, { etiqueta: "Plazo", valor: "30 meses" }] };
  expect((await call("/api/admin/contenido/propuestas/agua-potable", "PUT", body, cookies.coadmin)).status).toBe(200);
  expect((await call("/api/admin/contenido/propuestas/no-existe", "PUT", body, cookies.coadmin)).status).toBe(404);
  const muchas = { ...body, kpis: Array.from({ length: 7 }, () => ({ etiqueta: "x", valor: "1" })) };
  expect((await call("/api/admin/contenido/propuestas/agua-potable", "PUT", muchas, cookies.coadmin)).status).toBe(422);
  const c = await (await call("/api/admin/contenido", "GET", undefined, cookies.coadmin)).json();
  expect(c.propuestas[0]).toMatchObject({ introduccion: "Agua para todos.", kpis: body.kpis });
});

test("las fotos se validan por su contenido, se optimizan y pierden los metadatos", async () => {
  expect((await upload(new TextEncoder().encode("no soy una imagen"), "foto.jpg")).status).toBe(415);
  expect((await upload(await png(), "foto.png", "votante")).status).toBe(403);
  // JPEG con EXIF (autor y GPS ficticios): la versión guardada no debe conservarlo.
  const conExif = await sharp(await png(2000, 1000)).jpeg()
    .withExif({ IFD0: { Artist: "Prueba" }, IFD3: { GPSLatitudeRef: "N" } }).toBuffer();
  expect((await sharp(conExif).metadata()).exif).toBeDefined();
  const res = await upload(conExif, "foto.jpg");
  expect(res.status).toBe(200);
  const foto = await res.json();
  expect(foto).toMatchObject({ ancho: 2000, alto: 1000, anchos: [480, 960, 1600] });
  const guardada = await sharp(join(MEDIA, `${foto.nombre}-960.webp`)).metadata();
  expect(guardada).toMatchObject({ format: "webp", width: 960 });
  expect(guardada.exif).toBeUndefined();
  const pequena = await (await upload(await png(300, 200))).json();
  expect(pequena.anchos).toEqual([300]);
  // Durante el desarrollo el backend sirve el archivo; nombres raros no escapan de la carpeta.
  expect((await call(`/medios/${foto.nombre}-480.webp`)).status).toBe(200);
  expect((await call("/medios/..%2F..%2F.env")).status).toBe(404);
});

test("biografía y obras guardan fotos existentes; el porcentaje no se guarda", async () => {
  const foto = await (await upload(await png())).json();
  const hito = { anios: "1990", titulo: "Raíces", texto: "Primer párrafo.\n\nSegundo párrafo.", idMedio: foto.idMedio, alt: "Carlos de niño" };
  expect((await call("/api/admin/contenido/biografia", "PUT", { hitos: [hito] }, cookies.coadmin)).status).toBe(200);
  expect((await call("/api/admin/contenido/biografia", "PUT", { hitos: [{ ...hito, idMedio: 99999 }] }, cookies.coadmin)).status).toBe(422);
  const obra = { nota: "Avanza la red.", hitos: [{ nombre: "Diseño", completado: true }, { nombre: "Obra", completado: false }],
    fotos: [{ idMedio: foto.idMedio, pie: "Tubería nueva" }] };
  expect((await call("/api/admin/contenido/obras/agua-potable", "PUT", obra, cookies.coadmin)).status).toBe(200);
  const c = await (await call("/api/admin/contenido", "GET", undefined, cookies.coadmin)).json();
  expect(c.biografia).toEqual([{ anios: "1990", titulo: "Raíces", texto: hito.texto, alt: "Carlos de niño",
    foto: { idMedio: foto.idMedio, nombre: foto.nombre, ancho: 1200, alto: 800, anchos: [480, 960, 1200] } }]);
  expect(c.obras[0]).toMatchObject({ slug: "agua-potable", hitos: obra.hitos, fotos: [{ pie: "Tubería nueva", nombre: foto.nombre }] });
  expect(c.obras[0]).not.toHaveProperty("porcentaje");
});

test("publicar congela el contenido, calcula lo pendiente y agrupa la cola", async () => {
  const pendientes = async () => (await (await call("/api/admin/publicaciones/pendientes", "GET", undefined, cookies.coadmin)).json()).cambios;
  expect(await pendientes()).toEqual([{ tipo: "Sitio", descripcion: "Primera publicación con el contenido del panel" }]);
  expect((await call("/api/admin/publicaciones", "POST", undefined, cookies.votante)).status).toBe(403);
  const primera = await (await call("/api/admin/publicaciones", "POST", undefined, cookies.coadmin)).json();
  const segunda = await (await call("/api/admin/publicaciones", "POST", undefined, cookies.admin)).json();
  expect(segunda.id).toBe(primera.id); // sigue en cola: se reemplaza, no se compila dos veces
  const [tomada] = await callPg<{ id_publicacion: number; contenido: { propuestas: unknown[] } }>(sql, "publicationClaim");
  expect(tomada.id_publicacion).toBe(primera.id);
  expect(tomada.contenido.propuestas).toHaveLength(7);
  expect(await callPg(sql, "publicationClaim")).toEqual([]);
  await callPg(sql, "publicationFinish", [tomada.id_publicacion, true, null]);
  expect(await pendientes()).toEqual([]);
  expect((await call("/api/admin/publicaciones", "POST", undefined, cookies.coadmin)).status).toBe(409);
  await call("/api/admin/contenido/textos/contacto.texto", "PUT", { valor: "Escríbenos." }, cookies.coadmin);
  expect(await pendientes()).toEqual([{ tipo: "Texto", descripcion: "contacto.texto" }]);
  const historial = await (await call("/api/admin/publicaciones?pagina=1", "GET", undefined, cookies.coadmin)).json();
  expect(historial).toMatchObject({ total: 1, pagina: 1, porPagina: 10, publicaciones: [{ id: primera.id, estado: "publicada" }] });
  expect((await (await call("/api/admin/publicaciones?pagina=5", "GET", undefined, cookies.coadmin)).json()).total).toBe(1);
});
