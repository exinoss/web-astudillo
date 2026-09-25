// Optimiza cada .glb de modelos-fuente/ hacia public/models/, con el mismo nombre.
// `--simplify false`: los modelos vienen de CAD y simplificar deforma las piezas.
// `--instance false`: model-viewer calcula mal la caja envolvente de las
// instancias de GPU; el modelo se encuadra más pequeño y las sombras flotan.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const fuente = "modelos-fuente";
const destino = "public/models";

for (const archivo of readdirSync(fuente).filter((f) => f.endsWith(".glb"))) {
  const entrada = join(fuente, archivo);
  const salida = join(destino, archivo);
  const proceso = spawnSync(
    "gltf-transform",
    [
      "optimize",
      entrada,
      salida,
      "--compress",
      "meshopt",
      "--simplify",
      "false",
      "--instance",
      "false",
    ],
    { shell: true },
  );
  if (proceso.status !== 0) {
    console.error(proceso.stderr?.toString());
    process.exit(1);
  }
  const kb = (ruta: string) => Math.round(statSync(ruta).size / 1024);
  console.log(`${archivo}: ${kb(entrada)} KB → ${kb(salida)} KB`);
}
