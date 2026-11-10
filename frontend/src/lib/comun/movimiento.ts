/** Indica si el panel de accesibilidad del sitio tiene activo «Reducir movimiento». */
export const sinMovimiento = () => document.documentElement.classList.contains("reduce-motion");

/** Avisa cada vez que cambian las clases de <html>, donde el panel de accesibilidad activa `reduce-motion`. */
export const alCambiarMovimiento = (avisar: () => void) =>
  new MutationObserver(avisar).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
