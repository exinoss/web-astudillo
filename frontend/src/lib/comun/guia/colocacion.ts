import type { Posicion } from "./pasos";

/** Parte del ancho del lienzo de Carlos que ocupa su cuerpo, sin el brazo extendido (medida en el atlas). */
export const CUERPO = { desde: 0.24, hasta: 0.76 };
const MARGEN = 12;

export interface Medidas {
  ventana: number;
  carlos: { w: number; h: number };
  globo: number;
  celular: boolean;
  arriba: boolean;
}

export interface Colocacion {
  carlos: number;
  globo: { left: number; width: number | null; top: number | null; bottom: number | null };
}

/** Dónde van Carlos y el globo; en celular, Carlos se pega al borde con el globo a su lado, o el globo arriba si `arriba`. */
export function colocacion(posicion: Posicion, m: Medidas): Colocacion {
  const { ventana: v, carlos: { w, h }, globo: g } = m;
  const lateral = m.celular && posicion !== "centro";
  const carlos = lateral
    ? posicion === "izquierda" ? 4 - CUERPO.desde * w : v - 4 - CUERPO.hasta * w
    : { izquierda: MARGEN, derecha: v - w - MARGEN, centro: (v - w) / 2 }[posicion];
  if (m.celular && m.arriba) return { carlos, globo: { left: MARGEN, width: v - 2 * MARGEN, top: 8, bottom: null } };
  if (lateral) {
    const left = posicion === "izquierda" ? carlos + CUERPO.hasta * w + 4 : MARGEN;
    const right = posicion === "izquierda" ? v - MARGEN : carlos + CUERPO.desde * w - 4;
    return { carlos, globo: { left, width: right - left, top: null, bottom: 8 } };
  }
  return { carlos, globo: { left: Math.min(Math.max(MARGEN, carlos + w / 2 - g / 2), v - g - MARGEN), width: null, top: null, bottom: h - 6 } };
}

/** Indica si el globo tapa menos del foco arriba (a 8 px del borde) que abajo (desde `abajo`); `ahora` evita que salte de un lado a otro. */
export function globoArriba(foco: { y: number; h: number }, abajo: number, alto: number, ahora: boolean) {
  const solape = (top: number) => Math.max(0, Math.min(foco.y + foco.h, top + alto) - Math.max(foco.y, top));
  return solape(8) + (ahora ? 0 : 20) < solape(abajo);
}
