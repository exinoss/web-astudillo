import { esc, escLines } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import { img } from "./html";
import { PROVIDER_NAMES, videoSource } from "./reproductor";
import type { AboutCarlosPageView } from "./vista";

export function videoSection(v: AboutCarlosPageView["video"]) {
  const source = v && videoSource(v.url);
  if (!v || !source) return "";
  return `
<section data-public-video aria-labelledby="video-titulo" class="mt-9 max-tablet:mt-8${v.vertical ? " grid grid-cols-[300px_minmax(0,1fr)] items-center gap-x-10 max-tablet:grid-cols-1" : ""}">
  <div${v.vertical ? ' class="col-start-2 row-start-1 max-tablet:col-start-1"' : ""}>
    <h2 id="video-titulo" class="mb-3 text-[2rem]">${esc(v.title)}</h2>
    ${v.description ? `<p class="mt-0 mb-4 max-w-[420px] text-[1rem] leading-[1.7]">${escLines(v.description)}</p>` : ""}
  </div>
  <div data-video-preview data-embed="${esc(source.embed)}" data-provider="${source.provider}" class="min-w-0 ${v.vertical ? "col-start-1 row-start-1 max-w-[300px] max-tablet:row-start-2" : "max-w-[650px]"}">
    <div data-video-stage class="relative overflow-hidden rounded-[12px] bg-primary ${v.vertical ? "aspect-[9/16]" : "aspect-video"}">
      ${img(v.cover, "", "absolute inset-0 h-full w-full object-cover object-[50%_25%]", v.vertical ? "300px" : "(max-width: 760px) calc(100vw - 40px), 650px")}
      <div aria-hidden="true" class="absolute inset-0 [background:linear-gradient(to_top,#063176e6_0%,transparent_45%)]"></div>
      <button data-video-play type="button" aria-label="Reproducir el video: ${esc(v.title)}" class="group absolute inset-0 flex items-end p-4 text-left text-white">
        <span class="flex items-center gap-2.5 text-[0.9rem] font-bold">
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary transition-transform group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>
          </span>
          Ver video · ${PROVIDER_NAMES[source.provider]}
        </span>
      </button>
      <div data-video-error hidden class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-primary px-5 text-center text-white">
        ${iconSvg("alert", 28)}
        <strong class="text-base">El video no está disponible.</strong>
        <button data-video-retry type="button" class="min-h-11 rounded-[3px] border border-white px-4 text-sm font-bold">Reintentar</button>
        <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Ver en ${PROVIDER_NAMES[source.provider]}</a>
      </div>
    </div>
  </div>
</section>`;
}
