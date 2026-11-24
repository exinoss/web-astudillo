export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Consulta de medios de los celulares; debe coincidir con la variante `celular:` de styles/global.css. */
export const CELULAR = "(width <= 480px), (orientation: landscape) and (height <= 500px) and (pointer: coarse)";

/** Indica si el elemento ocupa sitio en la página y no está oculto. */
export const visible = (el: Element | null): el is HTMLElement =>
  !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/** Indica si el elemento no se mueve al desplazar la página (él o un antecesor es fijo, o está en la cabecera). */
export function esFijo(el: Element) {
  if (el.closest(".site-header")) return true;
  for (let e: Element | null = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true;
  return false;
}

/** Elementos visibles que coinciden con el selector. */
export const visibles = (sel: string) => [...document.querySelectorAll(sel)].filter(visible);

/** Rectángulo del elemento en la ventana. */
export function rectEl(el: Element): Rect {
  const b = el.getBoundingClientRect();
  return { x: b.left, y: b.top, w: b.width, h: b.height };
}

/** Rectángulo que une los elementos visibles de los selectores, o null si no hay ninguno. */
export function rectDe(selectores: string[]): Rect | null {
  const rects = selectores.flatMap(visibles).map(rectEl).filter((r) => r.w && r.h);
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

/** Borde inferior de la cabecera fija del sitio en la ventana. */
export const altoCabecera = () => Math.max(0, document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0);

/** Resuelve cuando el selector es visible o pasa `ms`. */
export function esperarA(sel: string, ms: number) {
  return new Promise<void>((resolver) => {
    const fin = Date.now() + ms;
    const mirar = () => (visible(document.querySelector(sel)) || Date.now() > fin ? resolver() : setTimeout(mirar, 120));
    mirar();
  });
}

/** Resuelve tras `ms` milisegundos. */
export const espera = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));
