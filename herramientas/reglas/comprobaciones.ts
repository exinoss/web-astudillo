export type Falta = { regla: string; archivo: string; linea: number; texto: string; mensaje: string };
export type Archivo = { ruta: string; contenido: string };

const FRONT = /^frontend\/src\/.*\.(ts|astro)$/;
const CODIGO_TS = /^(?:(?:frontend|backend)\/src\/.*|herramientas\/.*)\.ts$/;
const SQL = /^backend\/database\/funciones\/.*\.sql$/;

/** Recorre las líneas de un archivo y devuelve una falta por cada coincidencia de `patron`. */
function porLinea(a: Archivo, regla: string, patron: RegExp, mensaje: string): Falta[] {
  return a.contenido.split("\n").flatMap((texto, i) =>
    patron.test(texto) ? [{ regla, archivo: a.ruta, linea: i + 1, texto: texto.trim(), mensaje }] : []);
}

/** Colores escritos a mano en lugar de los tokens de `@theme`. */
function colorAMano(a: Archivo) {
  if (!FRONT.test(a.ruta)) return [];
  return porLinea(a, "color-a-mano", /(?<![\w&])#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|\[#[0-9a-fA-F]{3,4}\]|:\s*#[0-9a-fA-F]{3,4}\b(?![\w-])/,
    "Color escrito a mano: usa un token de @theme (global.css).");
}

/** Breakpoints que no son las variantes propias de `global.css`. */
function breakpointAMano(a: Archivo) {
  if (!FRONT.test(a.ruta)) return [];
  return porLinea(a, "breakpoint-a-mano", /(?<![\w-])@?(?:min|max)-\[[^\]\s]+\]:|(?<![\w-])@?(?:sm|md|lg|xl|[2-7]xl):|@media\b/,
    "Breakpoint escrito a mano: usa las variantes de global.css (max-tablet:, celular:, contenedor-estrecho:…).");
}

/** Funciones sin su comentario de una línea encima, o con uno de varias. */
function comentarioDeFuncion(a: Archivo) {
  const ts = CODIGO_TS.test(a.ruta) && !a.ruta.endsWith(".d.ts");
  if (!ts && !SQL.test(a.ruta)) return [];
  const declaracion = ts
    ? /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*\w+|^(?:export\s+)?const\s+\w+(?:\s*:[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)?|\w+)\s*(?::[^=]+)?=>|^(?:export\s+)?const\s+\w+\s*=\s*(?:async\s+)?\(\s*$/
    : /^\s*create\s+(?:or\s+replace\s+)?function\b/i;
  const comentario = ts ? /^\s*(?:\/\/|\/\*\*.*\*\/\s*$)/ : /^\s*--/;
  const sigue = ts ? /^\s*(?:\/\/|\*|\/\*)/ : /^\s*--/;
  const lineas = a.contenido.split("\n");
  return lineas.flatMap((texto, i) => {
    if (!declaracion.test(texto)) return [];
    // En SQL el comentario va sobre el `DROP FUNCTION IF EXISTS` que precede al `CREATE`.
    let j = i - 1;
    while (!ts && /^\s*drop\s+function\b/i.test(lineas[j] ?? "")) j--;
    const arriba = lineas[j] ?? "", antes = lineas[j - 1] ?? "";
    if (comentario.test(arriba) && !sigue.test(antes)) return [];
    return [{ regla: "comentario-de-funcion", archivo: a.ruta, linea: i + 1, texto: texto.trim(),
      mensaje: "Cada función lleva encima una sola línea que dice qué hace." }];
  });
}

/** Peticiones de red fuera de los repositorios de `src/lib/data/`. */
function fetchFueraDeDatos(a: Archivo) {
  if (!FRONT.test(a.ruta) || a.ruta.startsWith("frontend/src/lib/data/")) return [];
  return porLinea(a, "fetch-fuera-de-datos", /\bfetch\(/, "Los datos pasan por los repositorios de src/lib/data/, no por un fetch directo.");
}

/** Imágenes locales enlazadas a mano en lugar de servirlas con `astro:assets`. */
function imagenSinAssets(a: Archivo) {
  if (!FRONT.test(a.ruta)) return [];
  return porLinea(a, "imagen-sin-assets", /\bsrc=["'][^"'{$]*\.(?:png|jpe?g|webp|avif|gif)["']/i,
    "Imagen local enlazada a mano: impórtala y sírvela con astro:assets.");
}

/** Dependencias que no estaban en el `package.json` de la última versión confirmada. */
export function dependenciasNuevas(a: Archivo, anterior: string | null): Falta[] {
  if (!/^(frontend|backend)\/package\.json$/.test(a.ruta)) return [];
  const nombres = (json: string | null) => {
    if (!json) return new Set<string>();
    const p = JSON.parse(json);
    return new Set(Object.keys({ ...p.dependencies, ...p.devDependencies }));
  };
  const antes = nombres(anterior);
  return [...nombres(a.contenido)].filter((n) => !antes.has(n)).map((n) => ({
    regla: "dependencia-nueva", archivo: a.ruta, linea: a.contenido.split("\n").findIndex((l) => l.includes(`"${n}"`)) + 1,
    texto: n, mensaje: "Dependencia nueva: debe justificarse y medirse, y la aprueba el usuario en excepciones.json.",
  }));
}

/** Devuelve los conjuntos de 4 o más clases de cada atributo `class` del archivo, con su línea. */
export function conjuntosDeClases(a: Archivo) {
  if (!FRONT.test(a.ruta)) return [];
  const lineas = a.contenido.split("\n");
  return lineas.flatMap((texto, i) => [...texto.matchAll(/\bclass(?:Name)?=\{?["'`]([^"'`]+)["'`]/g)].flatMap((m) => {
    const clases = m[1].replace(/\$\{[^}]*\}/g, " ").split(/\s+/).filter((c) => /^[\w@!:\-\[\]().\/%#&>,*=]+$/.test(c));
    return clases.length >= 4 ? [{ clave: [...new Set(clases)].sort().join(" "), linea: i + 1, texto: texto.trim() }] : [];
  }));
}

/** El mismo conjunto de 4 o más clases en tres archivos o más (la regla pide extraerlo antes de la tercera copia). */
export function clasesRepetidas(a: Archivo, indice: Map<string, Set<string>>) {
  return conjuntosDeClases(a).flatMap(({ clave, linea, texto }) => {
    const archivos = indice.get(clave);
    if (!archivos || archivos.size < 3) return [];
    const otros = [...archivos].filter((r) => r !== a.ruta).slice(0, 3).join(", ");
    return [{ regla: "clases-repetidas", archivo: a.ruta, linea, texto: clave,
      mensaje: `Estas clases ya están en ${archivos.size - 1} archivos más (${otros}): extráelas a un componente, una @utility o una constante de lib/.` }];
  });
}

/** Comprobaciones que solo necesitan el propio archivo. */
export function comprobarArchivo(a: Archivo): Falta[] {
  return [colorAMano, breakpointAMano, comentarioDeFuncion, fetchFueraDeDatos, imagenSinAssets].flatMap((c) => c(a));
}
