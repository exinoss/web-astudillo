import { expect, test } from "bun:test";
import { pruebasAfectadas } from "./pruebas";

test("pruebas de Playwright de lo que cambió", () => {
  expect(pruebasAfectadas(["frontend/src/scripts/cuenta/panel/propuestas/index.ts"])).toEqual(["panel.spec.ts", "vista-previa.spec.ts"]);
  expect(pruebasAfectadas(["frontend/tests/seo.spec.ts", "frontend/src/components/ciudadania/Alerta.astro"])).toEqual(["seo.spec.ts", "participacion.spec.ts"]);
  expect(pruebasAfectadas(["frontend/src/styles/global.css", "backend/src/index.ts", "docs/a.md"])).toEqual([]);
});
