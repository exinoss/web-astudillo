import { alCambiarMovimiento, sinMovimiento } from "./movimiento";

/** Deslizar en horizontal más de 60 px llama a `paso` con 1 o -1; el gesto vertical sigue desplazando la página. */
export function deslizar(zona: HTMLElement, paso: (cuanto: -1 | 1) => void) {
  let x = 0;
  let y = 0;
  zona.addEventListener("touchstart", (e) => {
    x = e.changedTouches[0].clientX;
    y = e.changedTouches[0].clientY;
  }, { passive: true });
  zona.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - x;
    const dy = e.changedTouches[0].clientY - y;
    // Un diálogo abierto dentro de la zona (el visor de fotos) tiene sus propios gestos.
    if ((e.target as Element).closest("dialog") !== zona.closest("dialog")) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) paso(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/** Llama a `avanzar` cada `ms` si `puede()`, salvo con «Reducir movimiento» o la pestaña oculta; devuelve cómo reiniciarlo. */
export function autoavance(avanzar: () => void, ms: number, puede = () => true) {
  let reloj: ReturnType<typeof setInterval> | undefined;
  const sincronizar = () => {
    clearInterval(reloj);
    if (puede() && !sinMovimiento() && !document.hidden) reloj = setInterval(avanzar, ms);
  };
  document.addEventListener("visibilitychange", sincronizar);
  alCambiarMovimiento(sincronizar);
  sincronizar();
  return sincronizar;
}
