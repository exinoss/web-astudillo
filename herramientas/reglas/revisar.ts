import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { clasesRepetidas, comprobarArchivo, conjuntosDeClases, dependenciasNuevas, type Archivo, type Falta } from "./comprobaciones";

type Excepcion = { regla: string; archivo: string; texto: string; motivo: string };
type Modo = "diff" | "staged" | "todo";

export const RAIZ = join(import.meta.dir, "../..");
const EXCEPCIONES = join(import.meta.dir, "excepciones.json");
const MOTIVO_CONGELADO = "Existente al congelar la lista; pendiente de corregir.";
const REVISABLES = /^(?:herramientas\/.*\.ts|frontend\/src\/.*\.(?:ts|astro)|backend\/src\/.*\.ts|backend\/database\/funciones\/.*\.sql|(?:frontend|backend)\/package\.json)$/;

/** Ejecuta git en la raíz y devuelve su salida, o null si falla. */
function git(...args: string[]) {
  const r = Bun.spawnSync(["git", ...args], { cwd: RAIZ });
  return r.exitCode === 0 ? r.stdout.toString() : null;
}

/** Separa la salida de git en rutas, sin líneas vacías. */
const lista = (salida: string | null) => (salida ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Rutas que revisa cada modo, relativas a la raíz y con barras normales. */
export function rutasDe(modo: Modo) {
  const rutas = modo === "staged" ? lista(git("diff", "--cached", "--name-only", "--diff-filter=ACMR"))
    : modo === "todo" ? [...lista(git("ls-files")), ...lista(git("ls-files", "--others", "--exclude-standard"))]
    : [...lista(git("diff", "--name-only", "--diff-filter=ACMR", "HEAD")), ...lista(git("ls-files", "--others", "--exclude-standard"))];
  return [...new Set(rutas)].filter((r) => REVISABLES.test(r));
}

/** Convierte una ruta cualquiera en la forma relativa que usan las comprobaciones. */
export const normalizar = (ruta: string) => (isAbsolute(ruta) ? relative(RAIZ, ruta) : ruta).replaceAll("\\", "/");

/** Lee un archivo del área de preparación o del disco, según el modo. */
function leer(ruta: string, modo: Modo): string | null {
  if (modo === "staged") return git("show", `:${ruta}`);
  const completa = join(RAIZ, ruta);
  return existsSync(completa) ? readFileSync(completa, "utf8").replaceAll("\r\n", "\n") : null;
}

/** Índice de cada conjunto de clases con los archivos donde aparece, para detectar copias. */
function indiceDeClases(modo: Modo, propios: Archivo[]) {
  const indice = new Map<string, Set<string>>();
  const propiosPorRuta = new Map(propios.map((a) => [a.ruta, a]));
  const todos = [...lista(git("ls-files", "frontend/src")), ...lista(git("ls-files", "--others", "--exclude-standard", "frontend/src"))];
  for (const ruta of new Set(todos)) {
    const contenido = propiosPorRuta.get(ruta)?.contenido ?? leer(ruta, modo === "staged" ? "diff" : modo);
    if (contenido === null) continue;
    for (const { clave } of conjuntosDeClases({ ruta, contenido })) indice.set(clave, (indice.get(clave) ?? new Set()).add(ruta));
  }
  return indice;
}

/** Lee la lista de excepciones aprobadas. */
export const leerExcepciones = (): Excepcion[] => (existsSync(EXCEPCIONES) ? JSON.parse(readFileSync(EXCEPCIONES, "utf8")).excepciones : []);

/** Identifica una falta sin depender de su número de línea. */
const claveDe = (f: { regla: string; archivo: string; texto: string }) => `${f.regla}|${f.archivo}|${f.texto}`;

/** Revisa las rutas indicadas y devuelve las faltas que no están en la lista de excepciones. */
export function revisar(rutas: string[], modo: Modo, conExcepciones = true): Falta[] {
  const archivos = rutas.flatMap((ruta) => { const contenido = leer(ruta, modo); return contenido === null ? [] : [{ ruta, contenido }]; });
  const indice = indiceDeClases(modo, archivos);
  const faltas = archivos.flatMap((a) => [
    ...comprobarArchivo(a),
    ...clasesRepetidas(a, indice),
    ...dependenciasNuevas(a, modo === "todo" ? null : git("show", `HEAD:${a.ruta}`)),
  ]);
  if (!conExcepciones) return faltas;
  const permitidas = new Set(leerExcepciones().map(claveDe));
  return faltas.filter((f) => !permitidas.has(claveDe(f)));
}

/** Texto de las faltas para la terminal o para el agente. */
export const informe = (faltas: Falta[]) =>
  faltas.map((f) => `${f.archivo}:${f.linea}  [${f.regla}] ${f.mensaje}\n    ${f.texto.slice(0, 160)}`).join("\n") +
  `\n\n${faltas.length} falta(s) de las reglas. Corrígelas; si una debe quedarse, solo el usuario puede añadirla a herramientas/reglas/excepciones.json.`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--congelar")) {
    const manuales = leerExcepciones().filter((e) => e.motivo !== MOTIVO_CONGELADO);
    const congeladas = revisar(rutasDe("todo"), "todo", false).map(({ regla, archivo, texto }) => ({ regla, archivo, texto, motivo: MOTIVO_CONGELADO }));
    const unicas = [...new Map([...manuales, ...congeladas].map((e) => [claveDe(e), e])).values()]
      .sort((x, y) => x.archivo.localeCompare(y.archivo) || x.regla.localeCompare(y.regla));
    writeFileSync(EXCEPCIONES, JSON.stringify({ excepciones: unicas }, null, 2) + "\n");
    console.log(`Lista congelada: ${unicas.length} excepciones (${manuales.length} aprobadas a mano).`);
    process.exit(0);
  }
  const modo: Modo = args.includes("--staged") ? "staged" : args.includes("--todo") ? "todo" : "diff";
  const explicitas = args.filter((a) => !a.startsWith("--")).map(normalizar);
  const faltas = revisar(explicitas.length ? explicitas : rutasDe(modo), explicitas.length ? "diff" : modo);
  if (!faltas.length) process.exit(0);
  console.error(informe(faltas));
  process.exit(1);
}
