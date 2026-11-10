import { sinMovimiento } from "./movimiento";
import { esc } from "./html";
import { iconSvg } from "./iconos";

export interface Notificacion {
  tipo: "aviso" | "error" | "exito";
  titulo: string;
  texto?: string;
  enlace?: { texto: string; ruta: string };
}

export const BORRADOR_GUARDADO: Notificacion = { tipo: "exito", titulo: "Guardado como borrador", texto: "Publica cuando quieras que se vea en el sitio." };

// Un aviso se lee y se decide; un error se lee; un éxito solo se confirma.
const DURACION = { aviso: 10_000, error: 6_000, exito: 3_000 };
const ESTILO = {
  aviso: { borde: "border-l-secondary", barra: "bg-secondary", icono: "bg-error-soft text-error" },
  error: { borde: "border-l-error", barra: "bg-error", icono: "bg-error-soft text-error" },
  exito: { borde: "border-l-success", barra: "bg-success", icono: "bg-success-soft text-success" },
};
let actual: HTMLElement | null = null;

/** Muestra la notificación global (una a la vez); se cierra sola y su tiempo se detiene con el mouse o el foco encima. */
export function notificar(n: Notificacion) {
  actual?.remove();
  const estilo = ESTILO[n.tipo];
  const caja = document.createElement("div");
  actual = caja;
  caja.setAttribute("role", n.tipo === "error" ? "alert" : "status");
  caja.dataset.notificacion = n.tipo;
  caja.className = `fixed right-6 bottom-[68px] z-[960] grid w-[380px] grid-cols-[36px_minmax(0,1fr)_44px] items-start gap-3 overflow-hidden rounded-card border border-l-4 border-base-300 ${estilo.borde} bg-base-100 pt-3.5 pr-1.5 pb-[17px] pl-3.5 text-primary [box-shadow:0_14px_34px_#0631762e] max-tablet:right-3 max-tablet:left-3 max-tablet:w-auto`;
  caja.innerHTML = `
    <span class="grid size-9 place-items-center rounded-full ${estilo.icono}">${iconSvg(n.tipo === "exito" ? "check" : "alert", 20)}</span>
    <div class="min-w-0">
      <strong class="block text-[0.9rem]">${esc(n.titulo)}</strong>
      ${n.texto ? `<p class="mt-1 mb-0 text-[0.82rem] leading-[1.45] text-primary">${esc(n.texto)}</p>` : ""}
      ${n.enlace ? `<a href="${esc(n.enlace.ruta)}" class="mt-2.5 inline-flex min-h-11 items-center rounded-card bg-primary px-3.5 text-[0.8rem] font-bold whitespace-nowrap text-primary-content hover:bg-neutral">${esc(n.enlace.texto)}</a>` : ""}
    </div>
    <button type="button" class="-mt-2 grid size-11 place-items-center" aria-label="Cerrar aviso">${iconSvg("close", 20)}</button>
    <span aria-hidden="true" class="absolute inset-x-0 bottom-0 h-[3px] origin-left ${estilo.barra} ${sinMovimiento() ? "invisible" : ""}"></span>`;
  // Un <dialog> modal deja inerte lo que queda fuera: dentro de él se ve y se cierra, y al cerrarse vuelve a la página.
  const ventana = document.querySelector<HTMLDialogElement>("dialog:modal");
  (ventana ?? document.body).append(caja);
  ventana?.addEventListener("close", () => { if (caja.isConnected) document.body.append(caja); }, { once: true });
  const cerrar = () => { caja.remove(); if (actual === caja) actual = null; };
  caja.querySelector("button")!.addEventListener("click", cerrar);
  if (!sinMovimiento()) caja.animate([{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0" }], { duration: 180, easing: "ease-out" });
  // La barra es el reloj: al terminar cierra la notificación, y con «Reducir movimiento» corre igual sin verse.
  const tiempo = caja.lastElementChild!.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: DURACION[n.tipo], easing: "linear", fill: "forwards" });
  tiempo.onfinish = cerrar;
  const seguir = () => { if (!caja.matches(":hover") && !caja.contains(document.activeElement)) tiempo.play(); };
  caja.addEventListener("pointerenter", () => tiempo.pause());
  caja.addEventListener("focusin", () => tiempo.pause());
  caja.addEventListener("pointerleave", seguir);
  caja.addEventListener("focusout", () => setTimeout(seguir));
}
