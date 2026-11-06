import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { informe, RAIZ, revisar } from "../revisar";

const MAX_INTENTOS = 3;
const VIGILADAS = /^(?:(?:frontend\/(?:src|tests)|backend\/(?:src|database|tests)|herramientas)\/|(?:frontend|backend)\/package\.json$)/;

// Compartido por Claude Code y Codex: lo que verificó uno no lo repite el otro.
const estadoRuta = join(tmpdir(), "verificacion-reglas", `${Bun.hash(RAIZ)}.json`);
const leido = existsSync(estadoRuta) ? JSON.parse(readFileSync(estadoRuta, "utf8")) : {};
const estado: { verificados: Record<string, string>; huellaFallo: string; intentos: number } = { verificados: {}, huellaFallo: "", intentos: 0, ...leido };
/** Guarda el resultado de la última verificación de esta copia del proyecto. */
const guardar = (cambios: Partial<typeof estado>) => { mkdirSync(join(estadoRuta, ".."), { recursive: true }); writeFileSync(estadoRuta, JSON.stringify({ ...estado, ...cambios })); };

/** Ejecuta un comando en una carpeta del proyecto y devuelve si pasó y el final de su salida. */
function correr(carpeta: string, comando: string[]) {
  const r = Bun.spawnSync(comando, { cwd: join(RAIZ, carpeta) });
  const salida = (r.stdout.toString() + r.stderr.toString()).trim().split("\n").slice(-25).join("\n");
  return { ok: r.exitCode === 0, salida };
}

/** Ejecuta git en la raíz y devuelve sus líneas. */
const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: RAIZ }).stdout.toString().split("\n").filter(Boolean);
const cambiadas = [...new Set([...git("diff", "--name-only", "HEAD"), ...git("ls-files", "--others", "--exclude-standard")])].filter((r) => VIGILADAS.test(r));
const huellas = Object.fromEntries(cambiadas.map((r) => [r, existsSync(join(RAIZ, r)) ? String(Bun.hash(readFileSync(join(RAIZ, r)))) : "borrado"]));
// Solo lo que cambió desde la última verificación que pasó.
const nuevas = cambiadas.filter((r) => estado.verificados[r] !== huellas[r]);
if (!nuevas.length) process.exit(0);

/** Indica si alguna ruta nueva empieza por `prefijo`. */
const tocan = (prefijo: string) => nuevas.some((r) => r.startsWith(prefijo));
const pasos: [string, () => { ok: boolean; salida: string }][] = [
  ["reglas", () => { const f = revisar(nuevas, "diff"); return { ok: !f.length, salida: f.length ? informe(f) : "" }; }],
];
if (tocan("herramientas/")) pasos.push(["pruebas de las reglas", () => correr(".", ["bun", "test", "herramientas/reglas"])]);
if (tocan("backend/src/")) pasos.push(["check del backend", () => correr("backend", ["bun", "run", "check"])]);
if (tocan("frontend/src/")) pasos.push(["check del frontend", () => correr("frontend", ["bun", "run", "check"])]);

const huellaFallo = String(Bun.hash(nuevas.map((r) => r + huellas[r]).join("\0")));
for (const [nombre, paso] of pasos) {
  const { ok, salida } = paso();
  if (ok) continue;
  const intentos = (estado.huellaFallo === huellaFallo ? estado.intentos : 0) + 1;
  guardar({ huellaFallo, intentos: intentos > MAX_INTENTOS ? 0 : intentos });
  const motivo = `Falla «${nombre}». Corrígelo antes de terminar; si la falta está en un cambio que no hiciste en esta sesión, no lo toques y avísale al usuario.\n\n${salida}`;
  console.log(JSON.stringify(intentos > MAX_INTENTOS
    ? { systemMessage: `La verificación sigue fallando tras ${MAX_INTENTOS} intentos («${nombre}»). Revisa el cambio antes de hacer commit.` }
    : { decision: "block", reason: motivo }));
  process.exit(0);
}
guardar({ verificados: huellas, huellaFallo: "", intentos: 0 });
console.log(JSON.stringify({ systemMessage: `Verificación superada (${nuevas.length} archivo(s) nuevos): ${pasos.map(([n]) => n).join(" · ")}.` }));
