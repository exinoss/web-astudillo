import type { ModelViewerElement } from "@google/model-viewer";
import { ORBITA_RECORRIDO } from "./model3d.ts";

const ATRIBUTOS = {
  "min-camera-orbit": "auto 0deg 80m",
  "max-camera-orbit": "auto 85deg auto",
  "rotation-per-second": "2deg",
  "disable-tap": "",
};

/** Punto del suelo bajo (x, y), cortando el rayo con la caja del modelo: la búsqueda de model-viewer congela la página. */
function rayoAlSuelo(visor: ModelViewerElement, clienteX: number, clienteY: number) {
  const caja = visor.getBoundingClientRect(), o = visor.getCameraOrbit(), t = visor.getCameraTarget();
  const c = visor.getBoundingBoxCenter(), d = visor.getDimensions(), suelo = c.y - d.y / 2;
  const az = o.theta - visor.turntableRotation, s = Math.sin(o.phi);
  const f = [-s * Math.sin(az), -Math.cos(o.phi), -s * Math.cos(az)];
  const camara = [t.x - o.radius * f[0], t.y - o.radius * f[1], t.z - o.radius * f[2]];
  const n = Math.hypot(f[0], f[2]), der = [-f[2] / n, 0, f[0] / n];
  const arriba = [-der[2] * f[1], der[2] * f[0] - der[0] * f[2], der[0] * f[1]];
  const k = Math.tan((visor.getFieldOfView() * Math.PI) / 360);
  const px = (((clienteX - caja.left) / caja.width) * 2 - 1) * k * (caja.width / caja.height);
  const py = (1 - ((clienteY - caja.top) / caja.height) * 2) * k;
  const dir = f.map((v, i) => v + px * der[i] + py * arriba[i]);
  if (dir[1] >= 0) return null;
  const l = (suelo - camara[1]) / dir[1], x = camara[0] + l * dir[0], z = camara[2] + l * dir[2];
  if (Math.abs(x - c.x) > d.x / 2 || Math.abs(z - c.z) > d.z / 2) return null;
  return { x, y: suelo, z, distancia: l * Math.hypot(...dir) };
}

/** Permite desplazar el modelo y acercarse a cualquier zona; un clic en el cielo vuelve al centro. */
export function activarRecorrido(visor: ModelViewerElement, sinMovimiento: () => boolean) {
  for (const [atributo, valor] of Object.entries(ATRIBUTOS)) visor.setAttribute(atributo, valor);
  const pulsados = new Set<number>();
  let inicio = { x: 0, y: 0, t: 0, objetivo: "" };

  visor.addEventListener("pointerdown", (e) => {
    if (!pulsados.size) inicio = { x: e.clientX, y: e.clientY, t: performance.now(), objetivo: String(visor.getCameraTarget()) };
    pulsados.add(e.pointerId);
  }, true);
  visor.addEventListener("pointercancel", (e) => pulsados.delete(e.pointerId), true);
  // En captura, antes que model-viewer: con altKey se salta su búsqueda lenta al terminar un desplazamiento.
  visor.addEventListener("pointerup", (e) => {
    if (!pulsados.delete(e.pointerId)) return;
    Object.defineProperty(e, "altKey", { value: true });
    if (pulsados.size) return;
    const o = visor.getCameraOrbit();
    const clic = performance.now() - inicio.t < 300 && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 3;
    if (clic && !rayoAlSuelo(visor, e.clientX, e.clientY)) {
      visor.cameraTarget = "auto auto auto";
      visor.cameraOrbit = `${o.theta}rad ${o.phi}rad ${ORBITA_RECORRIDO.split(" ")[2]}`;
      if (sinMovimiento()) visor.jumpCameraToGoal();
      return;
    }
    if (String(visor.getCameraTarget()) === inicio.objetivo) return;
    // Tras desplazar, el giro se apoya en el punto del suelo que queda en el centro, sin mover la vista.
    const caja = visor.getBoundingClientRect();
    const p = rayoAlSuelo(visor, caja.left + caja.width / 2, caja.top + caja.height / 2);
    if (!p) return;
    visor.cameraTarget = `${p.x}m ${p.y}m ${p.z}m`;
    visor.cameraOrbit = `${o.theta}rad ${o.phi}rad ${p.distancia}m`;
    visor.jumpCameraToGoal();
  }, true);
}
