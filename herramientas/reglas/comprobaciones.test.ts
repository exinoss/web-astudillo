import { expect, test } from "bun:test";
import { clasesRepetidas, comprobarArchivo, dependenciasNuevas, funcionesDeclaradas, funcionesRepetidas } from "./comprobaciones";

/** Reglas incumplidas por un archivo de ejemplo. */
const reglas = (ruta: string, contenido: string) => comprobarArchivo({ ruta, contenido }).map((f) => f.regla);
const TS = "frontend/src/lib/comun/x.ts";

test("colores y breakpoints a mano", () => {
  expect(reglas(TS, '/** a */\nconst c = "#1e7a3c";')).toContain("color-a-mano");
  expect(reglas(TS, 'const html = `<p class="bg-[#06317618]">`;')).toContain("color-a-mano");
  expect(reglas(TS, 'document.querySelector("#kpis");\nlocation.hash = "#add";')).not.toContain("color-a-mano");
  expect(reglas(TS, 'const c = "@min-[35rem]:grid-cols-2 md:flex";')).toContain("breakpoint-a-mano");
  expect(reglas(TS, 'const c = "max-tablet:flex contenedor-estrecho:grid min-h-[110px] max-w-[300px]";')).not.toContain("breakpoint-a-mano");
});

test("una sola línea de comentario encima de cada función", () => {
  expect(reglas(TS, "/** Suma. */\nexport function suma() {}")).not.toContain("comentario-de-funcion");
  expect(reglas(TS, "// Suma.\nconst suma = (a: number) => a;")).not.toContain("comentario-de-funcion");
  expect(reglas(TS, "export function suma() {}")).toContain("comentario-de-funcion");
  expect(reglas(TS, "/**\n * Suma.\n */\nexport function suma() {}")).toContain("comentario-de-funcion");
  expect(reglas(TS, "// Uno.\n// Dos.\nconst suma = () => 1;")).toContain("comentario-de-funcion");
  const sql = "backend/database/funciones/a.sql";
  expect(reglas(sql, "-- Borra.\nDROP FUNCTION IF EXISTS f(text);\nCREATE OR REPLACE FUNCTION f(p text)")).not.toContain("comentario-de-funcion");
  expect(reglas(sql, "CREATE OR REPLACE FUNCTION f(p text)")).toContain("comentario-de-funcion");
});

test("fetch, imágenes y dependencias", () => {
  expect(reglas("frontend/src/pages/a.astro", "await fetch('/api/x')")).toContain("fetch-fuera-de-datos");
  expect(reglas("frontend/src/lib/data/http/a.ts", "/** Pide. */\nconst pedir = () => fetch('/api/x');")).not.toContain("fetch-fuera-de-datos");
  expect(reglas("frontend/src/pages/a.astro", '<img src="/fotos/a.jpg" alt="" />')).toContain("imagen-sin-assets");
  expect(reglas("frontend/src/pages/a.astro", "<img src={foto.src} alt='' />")).not.toContain("imagen-sin-assets");
  const nuevas = dependenciasNuevas({ ruta: "frontend/package.json", contenido: '{"dependencies":{"astro":"1","react":"1"}}' }, '{"dependencies":{"astro":"1"}}');
  expect(nuevas.map((f) => f.texto)).toEqual(["react"]);
});

test("el mismo conjunto de clases en tres archivos", () => {
  const archivo = { ruta: "frontend/src/a.astro", contenido: '<p class="flex gap-2 p-4 text-sm">' };
  const clave = "flex gap-2 p-4 text-sm";
  expect(clasesRepetidas(archivo, new Map([[clave, new Set(["frontend/src/a.astro", "frontend/src/b.astro"])]]))).toHaveLength(0);
  expect(clasesRepetidas(archivo, new Map([[clave, new Set(["frontend/src/a.astro", "frontend/src/b.astro", "frontend/src/c.ts"])]]))).toHaveLength(1);
});

test("una función con el nombre de otra ya exportada en el mismo paquete", () => {
  const exportadas = new Map([["frontend:esc", new Set(["frontend/src/lib/comun/html.ts"])], ["frontend:GET", new Set(["frontend/src/pages/a.ts"])]]);
  const archivo = (contenido: string, ruta = "frontend/src/pages/sitemap.xml.ts") => funcionesRepetidas({ ruta, contenido }, exportadas).map((f) => f.texto);
  expect(archivo("/** Escapa. */\nconst esc = (t: string) => t;")).toEqual(["const esc = (t: string) => t;"]);
  expect(archivo("/** Escapa. */\nexport function esc(t: string) { return t; }", "frontend/src/lib/comun/html.ts")).toEqual([]);
  expect(archivo("/** Escapa. */\nconst esc = (t: string) => t;", "backend/src/a.ts")).toEqual([]);
  expect(archivo("/** Escapa. */\nconst escapar = (t: string) => t;")).toEqual([]);
  expect(archivo("/** Mapa. */\nexport const GET = () => new Response();")).toEqual([]);
  expect(funcionesDeclaradas({ ruta: "frontend/src/a.ts", contenido: "export async function a() {}\nconst b = async (x) => x;\n  function c() {}" })
    .map((f) => [f.nombre, f.exportada])).toEqual([["a", true], ["b", false]]);
});
