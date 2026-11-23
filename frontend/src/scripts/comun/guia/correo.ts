import { altoCabecera } from "../../../lib/comun/guia/elementos";

const ANCHO = 400;
let ventana: HTMLDivElement | null = null;
let boton: DOMRect | null = null;

/** Abre la ventana con el correo de confirmación real; resuelve cuando se conoce dónde está su botón. */
export async function mostrarCorreo(caja: HTMLElement, escenario: HTMLElement) {
  quitarCorreo();
  const nueva = document.createElement("div");
  ventana = nueva;
  nueva.className = "correo-guia fixed z-[84] overflow-hidden rounded-[10px] bg-base-100 [box-shadow:0_10px_40px_var(--color-velo)]";
  nueva.setAttribute("role", "img");
  nueva.setAttribute("aria-label", "Correo «Confirma tu correo» con el botón «Confirmar mi correo»");
  nueva.innerHTML = `<iframe src="/guia/correo-confirmacion.html" title="Correo de confirmación" tabindex="-1" inert class="block h-[1400px] w-[400px] origin-top-left border-0"></iframe><div class="correo-guia-boton absolute"></div>`;
  document.body.append(nueva);
  const marco = nueva.querySelector("iframe")!;
  await new Promise<void>((resolver) => {
    marco.addEventListener("load", () => resolver(), { once: true });
    setTimeout(resolver, 4000);
  });
  if (ventana !== nueva) return;
  boton = marco.contentDocument?.querySelector('a[href="#"]')?.getBoundingClientRect() ?? null;
  if (!boton) return quitarCorreo();
  ajustarCorreo(caja, escenario);
}

/** Muestra el correo en su versión de celular: a la derecha de los subtítulos si hay ancho, si no encima; lo que no quepa se recorta por arriba. */
export function ajustarCorreo(caja: HTMLElement, escenario: HTMLElement) {
  if (!ventana || !boton) return;
  const alto = boton.bottom + 76;
  const arriba = altoCabecera() + 12;
  const c = caja.getBoundingClientRect();
  const derecha = (parseFloat(caja.style.left) || c.left) + c.width;
  const lado = innerWidth - derecha - 24 >= 320;
  const anchoLibre = lado ? innerWidth - derecha - 36 : innerWidth - 24;
  const altoLibre = lado ? innerHeight - arriba - 16 : innerHeight - arriba - c.height - escenario.getBoundingClientRect().height - 10;
  const s = Math.max(0.3, Math.min(1, anchoLibre / ANCHO, Math.max(0.85, altoLibre / alto)));
  const visto = Math.min(alto, altoLibre / s);
  const corte = alto - visto;
  const x = lado ? derecha + 12 + (anchoLibre - ANCHO * s) / 2 : (innerWidth - ANCHO * s) / 2;
  const y = lado ? arriba + (altoLibre - visto * s) / 2 : arriba;
  Object.assign(ventana.style, { width: `${ANCHO * s}px`, height: `${visto * s}px`, left: `${x}px`, top: `${y}px` });
  ventana.querySelector("iframe")!.style.transform = `translateY(${-corte * s}px) scale(${s})`;
  Object.assign(ventana.querySelector<HTMLElement>(".correo-guia-boton")!.style, {
    left: `${boton.left * s}px`, top: `${(boton.top - corte) * s}px`, width: `${boton.width * s}px`, height: `${boton.height * s}px`,
  });
}

/** Cierra la ventana del correo. */
export function quitarCorreo() {
  ventana?.remove();
  ventana = null;
  boton = null;
}
