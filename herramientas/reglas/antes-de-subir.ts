import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruebasAfectadas } from "./pruebas";
import { RAIZ } from "./revisar";

const CERO = /^0+$/;

/** Rangos a probar por cada rama del push: desde lo ya subido o, si la rama es nueva, desde su base en main. */
export function rangos(entrada: string, baseNueva: (sha: string) => string, existe: (sha: string) => boolean) {
  return entrada.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 4 && !CERO.test(p[1]))
    .map(([, local, , remoto]) => ({ desde: !CERO.test(remoto) && existe(remoto) ? remoto : baseNueva(local), hasta: local }));
}

/** Ejecuta git en la raíz y devuelve su salida, o una cadena vacía si falla. */
const git = (...args: string[]) => { const r = Bun.spawnSync(["git", ...args], { cwd: RAIZ }); return r.exitCode === 0 ? r.stdout.toString().trim() : ""; };
/** Base en main de un commit, para una rama que aún no está en el remoto. */
const baseEnMain = (sha: string) => git("merge-base", sha, "origin/main") || git("merge-base", sha, "main");

if (import.meta.main) {
  // Git pasa por la entrada una línea por rama: «<ref local> <sha local> <ref remota> <sha remoto>».
  const lista = rangos(await Bun.stdin.text(), baseEnMain, (sha) => git("cat-file", "-t", sha) === "commit");
  if (!lista.length) lista.push({ desde: baseEnMain("HEAD"), hasta: "HEAD" });
  const rutas = lista.flatMap(({ desde, hasta }) => (desde ? git("diff", "--name-only", desde, hasta).split("\n").filter(Boolean) : []));
  if (!rutas.length) {
    console.log("No hay cambios nuevos desde el último push.");
    process.exit(0);
  }
  let specs = pruebasAfectadas(rutas);
  if (!specs.length) {
    console.log("Lo que subes no tiene pruebas de Playwright propias: lo cubre la integración continua.");
    process.exit(0);
  }

  // Con cambios sin commit, las pruebas usarían otros archivos que los del commit: no se recuerda nada.
  const limpio = !git("status", "--porcelain", "--untracked-files=no");
  const arbol = limpio ? git("rev-parse", "HEAD^{tree}") : "";
  const registro = join(tmpdir(), "verificacion-reglas", `${Bun.hash(RAIZ)}-push.json`);
  const pasadas: string[] = existsSync(registro) ? JSON.parse(readFileSync(registro, "utf8")) : [];
  if (arbol) {
    const yaPasadas = specs.filter((s) => pasadas.includes(`${arbol}:${s}`));
    specs = specs.filter((s) => !yaPasadas.includes(s));
    if (yaPasadas.length) console.log(`Ya pasaron con este mismo código: ${yaPasadas.join(", ")}`);
    if (!specs.length) process.exit(0);
  } else console.log("Aviso: hay cambios sin commit; las pruebas usan los archivos tal como están en disco.");

  console.log(`Pruebas de Playwright antes de subir: ${specs.join(", ")}`);
  const r = Bun.spawnSync(["bunx", "playwright", "test", ...specs, "--reporter=line"], { cwd: join(RAIZ, "frontend"), stdout: "inherit", stderr: "inherit" });
  if (r.exitCode === 0 && arbol) {
    mkdirSync(join(registro, ".."), { recursive: true });
    writeFileSync(registro, JSON.stringify([...pasadas, ...specs.map((s) => `${arbol}:${s}`)].slice(-200)));
  }
  process.exit(r.exitCode ?? 1);
}
