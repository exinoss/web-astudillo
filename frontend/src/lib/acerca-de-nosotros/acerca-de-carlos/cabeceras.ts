import { editable, img } from "./html";
import type { AboutCarlosPageView } from "./vista";

export function alcaldeHeader(t: Record<string, string>) {
  return `
<header class="max-w-[760px]">
  ${editable("span", "alcalde.antetitulo", t, "eyebrow")}
  ${editable("h1", "alcalde.titulo", t, "mt-3 mb-6 text-[clamp(2.5rem,4vw,3.4rem)] max-tablet:text-[2.4rem]")}
  <figure class="m-0 mb-5 border-l-[5px] border-campaign-red pl-5 max-tablet:pl-4">
    ${editable("blockquote", "alcalde.cita", t, "m-0 font-display text-[2rem] leading-[1.18] font-semibold max-tablet:text-[1.6rem]")}
    <figcaption class="mt-3 text-[0.85rem] font-bold tracking-[0.04em] uppercase">Carlos Astudillo</figcaption>
  </figure>
  ${editable("p", "alcalde.nota", t, "m-0 max-w-[680px] text-[1rem] leading-[1.7]")}
</header>`;
}

export function conoceMasHeader(t: Record<string, string>, portrait: AboutCarlosPageView["portrait"]) {
  return `
<header${portrait ? ' class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] items-center gap-10 max-tablet:grid-cols-1 max-tablet:gap-5"' : ""}>
  ${portrait ? img(portrait.image, portrait.alt, "aspect-[4/5] w-full rounded-[16px] object-cover object-top [box-shadow:0_18px_40px_#06317626] max-tablet:row-start-2 max-tablet:max-h-[520px]", "(max-width: 760px) calc(100vw - 40px), 380px", "eager") : ""}
  <div class="max-w-[760px]">
    ${editable("span", "conoce-mas.antetitulo", t, "eyebrow")}
    ${editable("h1", "conoce-mas.titulo", t, "mt-3 mb-4 text-[clamp(2.5rem,4vw,3.4rem)] max-tablet:text-[2.4rem]")}
    ${editable("p", "conoce-mas.texto", t, "m-0 text-[1rem] leading-[1.7]")}
  </div>
</header>`;
}
