import { esc } from "../comun/html";
import { iconSvg } from "../comun/iconos";

/** Información del prefecto (presentación y trayectoria); la pintan «Mi equipo» y la vista previa del panel. */
export const infoPrefecto = (presentacion: string, trayectoria: string[], cerrar = false) => `
  <div class="relative rounded-card border-t-4 border-secondary bg-primary px-8 py-7 text-primary-content wrap-anywhere max-tablet:px-[18px] max-tablet:py-5">
    ${cerrar ? `<button type="button" data-cerrar-info class="absolute top-1.5 right-1.5 boton-redondo hover:bg-primary-content/15" aria-label="Cerrar la información del prefecto">${iconSvg("close", 20)}</button>` : ""}
    ${presentacion ? `<p class="m-0 pr-8 text-[0.95rem] leading-[1.7] text-primary-content">${esc(presentacion)}</p>` : ""}
    ${trayectoria.length ? `<h3 class="${presentacion ? "mt-[22px]" : "mt-0"} mb-2.5 font-sans text-[0.72rem] font-bold tracking-[0.1em] text-accent uppercase">Trayectoria</h3>
    <ul class="m-0 grid list-none gap-2.5 p-0">${trayectoria.map((punto) => `
      <li class="flex items-start gap-3 text-[0.92rem] leading-normal"><span class="mt-px shrink-0 text-accent">${iconSvg("check", 18)}</span><span>${esc(punto)}</span></li>`).join("")}
    </ul>` : ""}
  </div>`;
