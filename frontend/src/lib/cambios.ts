// No usar en formularios que validan al pulsar (acceso, registro, alertas…): sus botones siempre activos.

/** JSON con las claves ordenadas: dos objetos iguales dan el mismo texto aunque cambie el orden. */
export const huella = (valor: unknown): string => JSON.stringify(valor, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

/**
 * Activa `boton` solo si `actual()` difiere de `base` y lo vuelve a comprobar con cada cambio del
 * formulario. Devuelve la comprobación para repetirla tras acciones que no disparan eventos.
 */
export function vigilarCambios(formulario: HTMLElement, boton: HTMLButtonElement, base: unknown, actual: () => unknown) {
  const original = huella(base);
  const comprobar = () => { boton.disabled = huella(actual()) === original; };
  formulario.addEventListener("input", comprobar);
  formulario.addEventListener("change", comprobar);
  comprobar();
  return comprobar;
}
