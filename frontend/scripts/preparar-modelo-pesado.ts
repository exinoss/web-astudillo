// Prepara para la web un .glb de millones de triángulos que `bun run modelos` estropearía
// (docs/plan-modelos-3d.md). Corre con Node y memoria de sobra:
//   node --max-old-space-size=14000 scripts/preparar-modelo-pesado.ts entrada.glb public/models/<nombre>.glb
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error("Uso: scripts/preparar-modelo-pesado.ts entrada.glb salida.glb");
  process.exit(1);
}
// Firefox no dibuja más de 30 M índices por llamada y corta el resto sin avisar.
const TRIANGULOS_POR_PIEZA = 5_000_000;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const temporal = mkdtempSync(join(tmpdir(), "modelo-pesado-"));
const paso = (nombre: string) => join(temporal, nombre);

function gltfTransform(...args: string[]) {
  const proceso = spawnSync(process.execPath, ["--max-old-space-size=14000", "node_modules/@gltf-transform/cli/bin/cli.js", ...args], { stdio: "inherit" });
  if (proceso.status !== 0) process.exit(1);
}

// Sin normales, model-viewer sombrea cada triángulo plano y los vértices se comparten: el modelo
// pesa la mitad y tarda bastante menos en prepararse. Con millones de triángulos, las curvas no
// muestran facetas (comprobado en el estadio).
const documento = await io.read(entrada);
for (const malla of documento.getRoot().listMeshes()) {
  for (const primitiva of malla.listPrimitives()) primitiva.setAttribute("NORMAL", null);
}
await io.write(paso("1.glb"), documento);

// 4096 px conserva el detalle de las texturas horneadas (p. ej., los paneles perforados).
gltfTransform("optimize", paso("1.glb"), paso("2.glb"), "--compress", "false", "--simplify", "false", "--instance", "false", "--texture-size", "4096");

// Va después de optimize, que vuelve a unir las primitivas.
const unido = await io.read(paso("2.glb"));
const buffer = unido.getRoot().listBuffers()[0];
for (const malla of unido.getRoot().listMeshes()) {
  for (const primitiva of malla.listPrimitives()) {
    const indices = primitiva.getIndices()!.getArray()!;
    const maximo = TRIANGULOS_POR_PIEZA * 3;
    if (indices.length <= maximo) continue;
    const nueva = new Int32Array(primitiva.getAttribute("POSITION")!.getCount());
    for (let inicio = 0; inicio < indices.length; inicio += maximo) {
      const parte = indices.subarray(inicio, Math.min(inicio + maximo, indices.length));
      nueva.fill(-1);
      const orden = new Int32Array(parte.length);
      const local = new Uint32Array(parte.length);
      let n = 0;
      for (let i = 0; i < parte.length; i++) {
        const v = parte[i];
        if (nueva[v] < 0) {
          nueva[v] = n;
          orden[n++] = v;
        }
        local[i] = nueva[v];
      }
      const pieza = unido.createPrimitive().setMaterial(primitiva.getMaterial()).setMode(primitiva.getMode());
      for (const semantica of primitiva.listSemantics()) {
        const atributo = primitiva.getAttribute(semantica)!;
        const tam = atributo.getElementSize();
        const origen = atributo.getArray()!;
        const destino = new (origen.constructor as any)(n * tam);
        for (let k = 0; k < n; k++) for (let c = 0; c < tam; c++) destino[k * tam + c] = origen[orden[k] * tam + c];
        pieza.setAttribute(semantica, unido.createAccessor().setType(atributo.getType()).setArray(destino).setNormalized(atributo.getNormalized()).setBuffer(buffer));
      }
      pieza.setIndices(unido.createAccessor().setType("SCALAR").setArray(n > 65535 ? local : new Uint16Array(local)).setBuffer(buffer));
      malla.addPrimitive(pieza);
    }
    primitiva.dispose();
  }
}
await unido.transform(prune());
await io.write(paso("3.glb"), unido);

// Con los 14 bits por defecto, en un predio de cientos de metros parpadean las líneas pintadas.
gltfTransform("meshopt", paso("3.glb"), salida, "--quantize-position", "16");
rmSync(temporal, { recursive: true, force: true });
console.log(`${salida}: ${(statSync(salida).size / 1_000_000).toFixed(1)} MB`);
