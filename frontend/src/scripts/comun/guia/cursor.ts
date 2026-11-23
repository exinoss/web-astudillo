import { alCambiarMovimiento, sinMovimiento } from "../../../lib/comun/movimiento";

let nodo: HTMLDivElement | null = null;
let activo = false;
let observando = false;

/** Crea el cursor fantasma en el centro inferior de la ventana. */
function poner() {
  if (nodo) return;
  nodo = document.createElement("div");
  nodo.className = "cursor-fantasma";
  nodo.setAttribute("aria-hidden", "true");
  nodo.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(nodo);
  moverCursorA(innerWidth / 2, innerHeight - 120);
}

/** Quita el cursor de la página. */
function sacar() {
  nodo?.remove();
  nodo = null;
}

/** Activa el cursor mientras dura la guía; con «Reducir movimiento» no aparece, y sigue los cambios de ese modo. */
export function activarCursor() {
  activo = true;
  if (!sinMovimiento()) poner();
  if (observando) return;
  observando = true;
  alCambiarMovimiento(() => (activo && !sinMovimiento() ? poner() : sacar()));
}

/** Quita el cursor al terminar la guía. */
export function desactivarCursor() {
  activo = false;
  sacar();
}

/** Indica si el cursor está en pantalla (las esperas son más cortas sin él). */
export const hayCursor = () => !!nodo;

/** Desliza el cursor hasta el punto (x, y) de la ventana. */
export function moverCursorA(x: number, y: number) {
  if (nodo) nodo.style.transform = `translate(${x}px, ${y}px)`;
}

/** Muestra la onda de un clic en la punta del cursor. */
export function pulsarCursor() {
  if (!nodo) return;
  nodo.classList.remove("clic");
  void nodo.offsetWidth;
  nodo.classList.add("clic");
}
