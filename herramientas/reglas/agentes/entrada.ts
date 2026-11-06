import { isAbsolute, join, relative, resolve } from "node:path";

export const RAIZ = join(import.meta.dir, "../../..");
export type Entrada = { tool_name?: string; tool_input?: Record<string, unknown>; cwd?: string; permission_mode?: string };

/** Rutas, relativas a la raíz, de los archivos que toca una herramienta de Claude Code (Edit/Write) o de Codex (apply_patch). */
export function rutasEditadas(entrada: Entrada) {
  const datos = entrada.tool_input ?? {};
  const rutas = entrada.tool_name === "apply_patch"
    ? [...String(datos.command ?? "").matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/gm)].map((m) => m[1].trim())
    : [datos.file_path ?? datos.notebook_path].filter((r): r is string => typeof r === "string");
  return rutas.map((r) => relative(RAIZ, resolve(entrada.cwd ?? RAIZ, r)).replaceAll("\\", "/"))
    .filter((r) => !r.startsWith("..") && !isAbsolute(r));
}
