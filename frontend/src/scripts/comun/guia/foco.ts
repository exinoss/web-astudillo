import type { Rect } from "../../../lib/comun/guia/elementos";
import { sinMovimiento } from "../../../lib/comun/movimiento";

let nodo: HTMLDivElement | null = null;
let meta: Rect | null = null;
let ahora: Rect | null = null;
let raf = 0;
let previo = 0;

/** Pide un fotograma para acercar el foco a su destino, si no hay uno pendiente. */
function pedirFotograma() {
  if (raf || !meta) return;
  previo = performance.now();
  raf = requestAnimationFrame(animar);
}

/** Acerca el foco a su destino (~95 % en 0,27 s) y lo dibuja; se detiene al llegar. */
function animar(t: number) {
  raf = 0;
  if (!nodo || !meta) return;
  const destino = meta;
  const k = !ahora || sinMovimiento() ? 1 : 1 - Math.exp(-Math.max(0, t - previo) / 90);
  previo = t;
  const actual = ahora;
  ahora = actual
    ? { x: actual.x + (destino.x - actual.x) * k, y: actual.y + (destino.y - actual.y) * k, w: actual.w + (destino.w - actual.w) * k, h: actual.h + (destino.h - actual.h) * k }
    : destino;
  const a = ahora;
  Object.assign(nodo.style, { left: `${a.x}px`, top: `${a.y - scrollY}px`, width: `${a.w}px`, height: `${a.h}px` });
  if ((["x", "y", "w", "h"] as const).some((c) => Math.abs(destino[c] - a[c]) > 0.5)) raf = requestAnimationFrame(animar);
}

/** Crea el velo con su hueco; se suaviza en coordenadas de la página para no quedarse atrás al desplazarse. */
export function crearFoco() {
  if (nodo) return;
  nodo = document.createElement("div");
  nodo.className = "foco";
  meta = ahora = null;
  document.body.append(nodo);
  addEventListener("scroll", pedirFotograma, { passive: true });
}

/** Lleva el hueco del foco a `r` (en la ventana); sin `r`, lo cierra en el centro y atenúa toda la página. */
export function focoA(r: Rect | null) {
  const p = 8;
  meta = r ? { x: r.x - p, y: r.y + scrollY - p, w: r.w + p * 2, h: r.h + p * 2 } : { x: innerWidth / 2, y: scrollY + innerHeight * 0.4, w: 0, h: 0 };
  pedirFotograma();
}

/** Quita el velo. */
export function quitarFoco() {
  cancelAnimationFrame(raf);
  raf = 0;
  nodo?.remove();
  nodo = meta = ahora = null;
  removeEventListener("scroll", pedirFotograma);
}
