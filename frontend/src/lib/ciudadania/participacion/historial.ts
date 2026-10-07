import { errorText, signedIn } from "../../cuenta/auth/page";
import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { ParticipationState } from "../../data/types";
import { ESTADOS } from "./tipos";

const fecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const CAJA = "flex flex-col items-center gap-2.5 rounded-[4px] border border-dashed border-base-300 px-4 py-7 text-center text-[0.84rem]";

/** Fila común de «Tus alertas» y «Tus sugerencias»; `miniatura` es el HTML del cuadro de la izquierda. */
export const filaHistorial = (o: { miniatura: string; titulo: string; estado: ParticipationState; texto: string; creadoEn: string }) => {
  const est = ESTADOS[o.estado];
  return `<li class="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-t-base-300 py-3.5">
    ${o.miniatura}
    <div class="min-w-0">
      <div class="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
        <strong class="flex items-center gap-1.5 text-[0.88rem]">${o.titulo}</strong>
        <span class="rounded-full px-2.5 py-[3px] text-[0.62rem] font-bold tracking-[0.08em] whitespace-nowrap uppercase ${est.clases}">${est.nombre}</span>
      </div>
      <p class="mt-1 mb-0 text-[0.78rem] leading-normal [overflow-wrap:anywhere]">${esc(o.texto)}</p>
      <time class="mt-1 block text-[0.72rem] text-base-content" datetime="${esc(o.creadoEn)}">${fecha.format(new Date(o.creadoEn))}</time>
    </div>
  </li>`;
};

export const cuadroIcono = (icono: string) =>
  `<span class="grid size-14 place-items-center rounded-[4px] bg-[#eef2f8] text-neutral">${iconSvg(icono, 26)}</span>`;

/** Pinta el historial del votante en `contenedor`; devuelve la función para volver a cargarlo tras un envío. */
export function historial<T>(contenedor: HTMLElement, o: {
  cargar: () => Promise<T[]>; fila: (item: T) => string; vacio: string; icono: string; sinSesion: string;
}) {
  const cargarHistorial = async () => {
    if (!(await signedIn())) {
      contenedor.innerHTML = `<div class="${CAJA.replace("gap-2.5", "gap-3")}">
      ${esc(o.sinSesion)}<a class="button min-h-11 px-5 py-0" href="/cuenta/">Iniciar sesión</a></div>`;
      return;
    }
    try {
      const items = await o.cargar();
      contenedor.innerHTML = items.length
        ? `<ol class="m-0 list-none p-0">${items.map(o.fila).join("")}</ol>`
        : `<div class="${CAJA}">${iconSvg(o.icono, 30)}${esc(o.vacio)}</div>`;
    } catch (error) {
      contenedor.innerHTML = `<p class="m-0 text-[0.84rem]">${esc(errorText(error))}</p>`;
    }
  };
  void cargarHistorial();
  return cargarHistorial;
}
