// Renderiza cada .glb de public/models/ con el encuadre del visor y lo guarda
// como póster transparente en src/assets/models/. Corre con Node: bajo Bun,
// Playwright se cuelga al lanzar el navegador en Windows.
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { ALTO_POSTER, ANCHO_POSTER, ORBITA } from "../src/lib/model3d.ts";

const archivos: Record<string, [Buffer, string]> = {
  "model-viewer.js": [
    readFileSync("node_modules/@google/model-viewer/dist/model-viewer.min.js"),
    "text/javascript",
  ],
  "decoder.js": [
    readFileSync("node_modules/meshoptimizer/meshopt_decoder.cjs"),
    "text/javascript",
  ],
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
  viewport: { width: ANCHO_POSTER, height: ALTO_POSTER },
});

for (const archivo of readdirSync("public/models").filter((f) =>
  f.endsWith(".glb"),
)) {
  archivos["modelo.glb"] = [
    readFileSync(`public/models/${archivo}`),
    "model/gltf-binary",
  ];
  await pagina.route("http://posters.local/**", (ruta) => {
    const nombre = ruta.request().url().split("/").pop()!;
    if (archivos[nombre]) {
      const [cuerpo, tipo] = archivos[nombre];
      return ruta.fulfill({ body: cuerpo, contentType: tipo });
    }
    return ruta.fulfill({
      contentType: "text/html",
      body: `<!doctype html><body style="margin:0;background:transparent">
        <script>self.ModelViewerElement = { meshoptDecoderLocation: "/decoder.js" };</script>
        <script type="module" src="/model-viewer.js"></script>
        <model-viewer id="visor" src="/modelo.glb" camera-orbit="${ORBITA}" shadow-intensity="1"
          style="width:${ANCHO_POSTER}px;height:${ALTO_POSTER}px;--poster-color:transparent">
          <div slot="progress-bar"></div>
        </model-viewer></body>`,
    });
  });
  await pagina.goto("http://posters.local/");
  await pagina.waitForFunction(
    () => (document.getElementById("visor") as any)?.loaded === true,
    null,
    { timeout: 60000 },
  );
  await pagina.waitForTimeout(1500);
  const destino = `src/assets/models/${archivo.replace(".glb", ".png")}`;
  await pagina
    .locator("#visor")
    .screenshot({ path: destino, omitBackground: true });
  await pagina.unrouteAll();
  console.log(`póster: ${destino}`);
}

await navegador.close();
