/** JSON con las claves ordenadas: dos objetos iguales dan el mismo texto aunque cambie el orden. */
export const huella = (valor: unknown): string => JSON.stringify(valor, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

const comprobaciones = new WeakMap<HTMLButtonElement, () => void>();
const enCurso = new Set<string | HTMLButtonElement>();
// Reordenar o cambiar de sección vuelve a dibujar el formulario con otro botón: la petición
// pendiente se asocia al id del formulario para que el botón nuevo también quede bloqueado.
const clave = (boton: HTMLButtonElement) => (boton.type === "submit" && boton.form?.id) || boton;

/** Devuelve la comprobación para repetirla tras acciones que no disparan `input` ni `change`. */
export function vigilarCambios(formulario: HTMLElement, boton: HTMLButtonElement, base: unknown, actual: () => unknown) {
  const original = huella(base);
  const comprobar = () => { boton.disabled = enCurso.has(clave(boton)) || huella(actual()) === original; };
  comprobaciones.set(boton, comprobar);
  formulario.addEventListener("input", comprobar);
  formulario.addEventListener("change", comprobar);
  comprobar();
  return comprobar;
}

/**
 * Ejecuta `accion` con `boton` bloqueado e ignora los clics o Enter que llegan mientras tanto.
 * Al terminar recalcula el botón vigente del formulario, que puede ser otro si se volvió a dibujar.
 */
export async function bloquearMientras(boton: HTMLButtonElement, accion: () => Promise<void>) {
  const k = clave(boton);
  if (enCurso.has(k)) return;
  enCurso.add(k);
  boton.disabled = true;
  try {
    await accion();
  } finally {
    enCurso.delete(k);
    const vigente = typeof k === "string" ? document.getElementById(k)?.querySelector<HTMLButtonElement>("button[type=submit]") : k;
    if (vigente) {
      const comprobar = comprobaciones.get(vigente);
      if (comprobar) comprobar();
      else vigente.disabled = false;
    }
  }
}
