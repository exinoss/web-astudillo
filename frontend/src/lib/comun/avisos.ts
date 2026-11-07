import type { Aviso } from "../../../../backend/src/contracts/avisos";

export type { Aviso };

const PUBLICANDO = "astudillo:publicando";
let actuales: Aviso[] = [];

/** Lee o escribe en `sessionStorage`; sin almacenamiento solo se pierde recordar entre páginas. */
function sesion(clave: string, valor?: string | null) {
  try {
    if (valor === undefined) return sessionStorage.getItem(clave);
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch { /* sin almacenamiento */ }
  return null;
}

/** Los últimos avisos que leyó la campana. */
export const avisosActuales = () => actuales;

/** Guarda la lista nueva y avisa a quien la muestra (campana y panel). */
export function publicarAvisos(avisos: Aviso[]) {
  actuales = avisos;
  document.dispatchEvent(new CustomEvent("avisos:lista", { detail: avisos }));
}

/** Llama a `alCambiar` con cada lista nueva de avisos. */
export const alCambiarAvisos = (alCambiar: (avisos: Aviso[]) => void) =>
  document.addEventListener("avisos:lista", (e) => alCambiar((e as CustomEvent<Aviso[]>).detail));

/** Pide a la campana que vuelva a leer los avisos, tras una acción que puede cambiarlos. */
export const pedirAvisos = () => document.dispatchEvent(new Event("avisos:pedir"));

/** Recuerda la publicación en curso para avisar cuando termine, aunque se cambie de página. */
export function seguirPublicacion(id: number) {
  sesion(PUBLICANDO, String(id));
  document.dispatchEvent(new Event("avisos:publicando"));
}

/** La publicación que se está siguiendo, o null si no hay ninguna (`terminar` la olvida). */
export function publicacionSeguida(terminar = false) {
  if (terminar) sesion(PUBLICANDO, null);
  return Number(sesion(PUBLICANDO)) || null;
}
