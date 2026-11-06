import { expect, test } from "bun:test";
import { join } from "node:path";
import { RAIZ, rutasEditadas } from "./entrada";

test("rutas de Edit/Write (Claude Code) y de apply_patch (Codex)", () => {
  expect(rutasEditadas({ tool_name: "Write", tool_input: { file_path: join(RAIZ, ".claude", "settings.json") } })).toEqual([".claude/settings.json"]);
  expect(rutasEditadas({ tool_name: "Edit", tool_input: { file_path: "C:/fuera/del/proyecto.ts" } })).toEqual([]);
  const parche = "*** Begin Patch\n*** Update File: frontend/src/a.ts\n@@\n-x\n+y\n*** Add File: herramientas/reglas/excepciones.json\n+{}\n*** Update File: b.ts\n*** Move to: .githooks/pre-commit\n*** End Patch";
  expect(rutasEditadas({ tool_name: "apply_patch", cwd: RAIZ, tool_input: { command: parche } }))
    .toEqual(["frontend/src/a.ts", "herramientas/reglas/excepciones.json", "b.ts", ".githooks/pre-commit"]);
  expect(rutasEditadas({ tool_name: "apply_patch", cwd: join(RAIZ, "frontend"), tool_input: { command: "*** Update File: src/a.ts" } })).toEqual(["frontend/src/a.ts"]);
});
