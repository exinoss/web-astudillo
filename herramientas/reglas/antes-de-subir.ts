import { join } from "node:path";
import { pruebasAfectadas } from "./pruebas";
import { RAIZ } from "./revisar";

/** Ejecuta git en la raíz y devuelve su salida, o una cadena vacía si falla. */
const git = (...args: string[]) => { const r = Bun.spawnSync(["git", ...args], { cwd: RAIZ }); return r.exitCode === 0 ? r.stdout.toString().trim() : ""; };

const base = git("merge-base", "HEAD", "origin/main") || git("merge-base", "HEAD", "main");
if (!base) {
  console.error("No se encontró main para comparar: no se pasan pruebas antes de subir.");
  process.exit(0);
}
const specs = pruebasAfectadas(git("diff", "--name-only", base, "HEAD").split("\n").filter(Boolean));
if (!specs.length) {
  console.log("Lo que subes no tiene pruebas de Playwright propias: lo cubre la integración continua.");
  process.exit(0);
}
if (git("status", "--porcelain", "--untracked-files=no")) console.log("Aviso: hay cambios sin commit; las pruebas usan los archivos tal como están en disco.");
console.log(`Pruebas de Playwright antes de subir: ${specs.join(", ")}`);
const r = Bun.spawnSync(["bunx", "playwright", "test", ...specs, "--reporter=line"], { cwd: join(RAIZ, "frontend"), stdout: "inherit", stderr: "inherit" });
process.exit(r.exitCode ?? 1);
