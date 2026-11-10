import { mostrarCarga } from "./animaciones";

/** JSON con las claves ordenadas: dos objetos iguales dan el mismo texto aunque cambie el orden. */
export const huella = (valor: unknown): string => JSON.stringify(valor, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

const comprobaciones = new WeakMap<HTMLButtonElement, () => void>();
const enCurso = new Set<string | HTMLButtonElement>();
/** Identifica la petición por el id del formulario (así el botón redibujado sigue bloqueado) o, sin él, por el botón. */
const clave = (boton: HTMLButtonElement) => (boton.type === "submit" && boton.form?.id) || boton;

/** Devuelve la comprobación para repetirla tras acciones que no disparan `input` ni `change`. */
export function vigilarCambios(formulario: HTMLElement, boton: HTMLButtonElement, base: unknown, actual: () => unknown) {
  const original = huella(base);
  const comprobar = () => { boton.disabled = enCurso.has(clave(boton)) || huella(actual()) === original; };
  const anterior = comprobaciones.get(boton);
  if (anterior) for (const tipo of ["input", "change"]) formulario.removeEventListener(tipo, anterior);
  comprobaciones.set(boton, comprobar);
  formulario.addEventListener("input", comprobar);
  formulario.addEventListener("change", comprobar);
  comprobar();
  return comprobar;
}

/** Ejecuta `accion` con el botón bloqueado e ignora los clics que llegan mientras tanto. */
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
      // `data-bloqueo` lo pone el límite de intentos (`bloqueo.ts`), que lo reactiva al acabar la cuenta atrás.
      else vigente.disabled = vigente.dataset.bloqueo !== undefined;
    }
  }
}

/** Ejecuta `accion` con el botón bloqueado y el loader sobre `zona`. */
export const enviarConCarga = (boton: HTMLButtonElement, zona: HTMLElement, accion: () => Promise<void>) =>
  bloquearMientras(boton, async () => {
    const terminarCarga = mostrarCarga(zona);
    try {
      await accion();
    } finally {
      terminarCarga();
    }
  });
