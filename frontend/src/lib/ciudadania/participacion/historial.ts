import { errorText, signedIn } from "../../cuenta/auth/page";
import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { ParticipationState, Published } from "../../data/types";
import { ESTADOS } from "./tipos";

const fecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const CAJA = "flex flex-col items-center gap-2.5 rounded-card border border-dashed border-base-300 px-4 py-7 text-center text-[0.84rem]";
const PILDORA = "rounded-full px-2.5 py-[3px] text-[0.62rem] font-bold tracking-[0.08em] whitespace-nowrap uppercase";

export type Vista = "publicas" | "mias";

/** Fila común de «Públicas» y «Mías»; `miniatura` es el HTML del cuadro de la izquierda y `nota`, texto tras la fecha. */
export const filaHistorial = (o: {
  miniatura: string; titulo: string; estado: ParticipationState; texto: string; creadoEn: string;
  publicada?: Pick<Published<object>, "autor" | "mia">; nota?: string;
}) => {
  const est = ESTADOS[o.estado];
  const autor = o.publicada
    ? `<strong>${o.publicada.autor ? esc(o.publicada.autor) : "Anónimo"}</strong>${o.publicada.mia ? ` <span class="${PILDORA} ml-1 bg-neutral-soft text-neutral">Tuya</span>` : ""} · `
    : "";
  return `<li class="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-t-base-300 py-3.5">
    ${o.miniatura}
    <div class="min-w-0">
      <div class="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
        <strong class="flex items-center gap-1.5 text-[0.88rem]">${o.titulo}</strong>
        <span class="${PILDORA} ${est.clases}">${est.nombre}</span>
      </div>
      <p class="mt-1 mb-0 text-[0.78rem] leading-normal wrap-anywhere">${esc(o.texto)}</p>
      <p class="mt-1 mb-0 text-[0.72rem] text-base-content">${autor}<time datetime="${esc(o.creadoEn)}">${fecha.format(new Date(o.creadoEn))}</time>${o.nota ? ` · ${esc(o.nota)}` : ""}</p>
    </div>
  </li>`;
};

/** Cuadro con el ícono de una fila sin foto. */
export const cuadroIcono = (icono: string) =>
  `<span class="grid size-14 place-items-center rounded-card bg-neutral-soft text-neutral">${iconSvg(icono, 26)}</span>`;

/** Pinta las pestañas «Públicas» y «Mías» del historial; devuelve la función que recarga y muestra «Mías» tras un envío. */
export function historial<T, P extends T>(aside: HTMLElement, o: {
  publicas: () => Promise<{ items: P[]; total: number }>; mias: () => Promise<T[]>;
  fila: (item: T | P, vista: Vista) => string;
  vacio: Record<Vista, string>; ayuda: Record<Vista, string>; icono: string; sinSesion: string;
}) {
  const contenedor = aside.querySelector<HTMLElement>("#historial")!;
  const ayuda = aside.querySelector<HTMLElement>("#historial-ayuda")!;
  const pestanas = [...aside.querySelectorAll<HTMLButtonElement>("[data-vista]")];
  let vista: Vista = "publicas";
  let datos: Record<Vista, (T | P)[] | null | Error> = { publicas: null, mias: null };

  const lista = (items: (T | P)[]) => items.length
    ? `<ol class="m-0 list-none p-0">${items.map((i) => o.fila(i, vista)).join("")}</ol>`
    : `<div class="${CAJA}">${iconSvg(o.icono, 30)}${esc(o.vacio[vista])}</div>`;

  const pintar = () => {
    ayuda.textContent = o.ayuda[vista];
    for (const p of pestanas) p.setAttribute("aria-selected", String(p.dataset.vista === vista));
    contenedor.setAttribute("aria-labelledby", `historial-${vista}`);
    const actual = datos[vista];
    contenedor.innerHTML = actual instanceof Error
      ? `<p class="m-0 text-[0.84rem]">${esc(errorText(actual))}</p>`
      : vista === "mias" && actual === null
        ? `<div class="${CAJA.replace("gap-2.5", "gap-3")}">${esc(o.sinSesion)}<a class="button min-h-11 px-5 py-0" href="/cuenta/">Iniciar sesión</a></div>`
        : lista(actual ?? []);
  };

  const contar = (v: Vista, n: number | null) => {
    pestanas.find((p) => p.dataset.vista === v)!.querySelector("[data-cuenta]")!.textContent = n === null ? "" : ` (${n})`;
  };

  const cargar = async () => {
    const [publicas, mias] = await Promise.all([
      o.publicas().catch((e: Error) => e),
      signedIn().then((si) => si ? o.mias() : null).catch((e: Error) => e),
    ]);
    datos = { publicas: publicas instanceof Error ? publicas : publicas.items, mias };
    contar("publicas", publicas instanceof Error ? null : publicas.total);
    contar("mias", Array.isArray(mias) ? mias.length : null);
    pintar();
  };

  for (const p of pestanas) p.addEventListener("click", () => { vista = p.dataset.vista as Vista; pintar(); });
  void cargar();
  return async () => { vista = "mias"; await cargar(); };
}
