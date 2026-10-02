import { TEXTOS, type TextKey } from "../../lib/contenido/textos";
import { adminApi } from "../../lib/data/http/admin-api";
import { renderPagination } from "../../lib/paginacion";
import { renderSocial } from "./redes";
import { busy, DRAFT_PILL, esc, GHOST, iconSvg, isPending, notify, PILL, reloadDraft, reloadPending, state } from "./ui";

const PAGE_SIZE = 20;
const filters = { q: "", lugar: "", estado: "", pagina: 1 };
const places = [...new Set(Object.values(TEXTOS).map((t) => t.lugar))];
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function renderTexts(section: HTMLElement) {
  const select = (id: string, label: string, options: [string, string][], current: string) => `
    <div class="flex min-w-[200px] flex-col gap-1.5 max-tablet:min-w-0">
      <label for="${id}" class="text-[0.76rem] font-bold">${label}</label>
      <select id="${id}" class="min-h-12 rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary">
        ${options.map(([v, t]) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(t)}</option>`).join("")}
      </select>
    </div>`;
  section.innerHTML = `
    <div id="panel-redes" class="mb-7"></div>
    <h2 class="m-0 mb-4 text-[2rem] leading-[1.05] max-tablet:text-[1.8rem]">Textos del sitio</h2>
    <div class="mb-[18px] flex items-end gap-3.5 max-tablet:grid max-tablet:grid-cols-2 max-tablet:gap-2.5">
      <div class="flex flex-1 flex-col gap-1.5 max-tablet:col-span-2">
        <label for="textos-buscar" class="text-[0.76rem] font-bold">Buscar</label>
        <input id="textos-buscar" type="search" value="${esc(filters.q)}" placeholder="Texto o página"
          class="min-h-12 rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary" />
      </div>
      ${select("textos-lugar", "Página", [["", "Todas"], ...places.map((p): [string, string] => [p, p])], filters.lugar)}
      ${select("textos-estado", "Estado", [["", "Todos"], ["borrador", "Borrador"], ["cambiado", "Cambiado"], ["original", "Original"]], filters.estado)}
    </div>
    <div id="textos-lista" class="rounded-[3px] border border-base-300 bg-base-100"></div>
    <div id="textos-paginas"></div>`;
  const input = section.querySelector<HTMLInputElement>("#textos-buscar")!;
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { filters.q = input.value; filters.pagina = 1; drawList(section); }, 250);
  });
  for (const [id, key] of [["#textos-lugar", "lugar"], ["#textos-estado", "estado"]] as const)
    section.querySelector<HTMLSelectElement>(id)!.addEventListener("change", (e) => {
      filters[key] = (e.target as HTMLSelectElement).value;
      filters.pagina = 1;
      drawList(section);
    });
  renderSocial(section.querySelector<HTMLElement>("#panel-redes")!);
  drawList(section);
}

function drawList(section: HTMLElement) {
  const overrides = state.draft!.textos;
  const q = normalize(filters.q.trim());
  const rows = (Object.entries(TEXTOS) as [TextKey, (typeof TEXTOS)[TextKey]][]).map(([clave, def]) => ({
    clave, def, valor: overrides[clave] ?? def.texto, borrador: isPending("Texto", clave), cambiado: clave in overrides,
  })).filter((r) => (!filters.lugar || r.def.lugar === filters.lugar)
    && (!filters.estado || (filters.estado === "borrador" ? r.borrador : filters.estado === "cambiado" ? r.cambiado : !r.cambiado))
    && (!q || normalize(`${r.def.lugar} ${r.def.campo} ${r.valor}`).includes(q)));
  const page = rows.slice((filters.pagina - 1) * PAGE_SIZE, filters.pagina * PAGE_SIZE);
  const list = section.querySelector<HTMLElement>("#textos-lista")!;
  list.innerHTML = page.length ? page.map((r) => `
    <div class="flex items-center gap-5 border-t border-t-base-300 px-5 py-4 first:border-t-0 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-2 max-tablet:px-4">
      <span class="flex w-[230px] shrink-0 flex-col gap-1 max-tablet:w-auto"><strong class="text-[0.85rem]">${esc(r.def.lugar)}</strong>
        <span class="text-[0.74rem] text-[#50617d]">${esc(r.def.campo)}</span></span>
      <span class="flex-1 text-[0.86rem] leading-normal whitespace-pre-line">${esc(r.valor)}</span>
      <span class="flex flex-wrap items-center gap-3 max-tablet:justify-between">
        ${r.borrador ? `<span class="${DRAFT_PILL}">Borrador</span>` : r.cambiado ? `<span class="${PILL} bg-[#e8f5ec] text-[#1d6b37]">Cambiado</span>` : `<span class="${PILL} border border-base-300">Original</span>`}
        ${r.cambiado ? `<button type="button" class="${GHOST}" data-original="${esc(r.clave)}">Volver al original</button>` : ""}
        <a class="inline-flex min-h-11 items-center gap-1.5 text-[0.8rem] font-bold whitespace-nowrap" href="${esc(`${r.def.ruta}?editar=${encodeURIComponent(r.clave)}`)}">${iconSvg("edit", 16)} Editar en el sitio</a>
      </span>
    </div>`).join("") : `<p class="m-0 px-5 py-6 text-[0.86rem]">Ningún texto coincide con la búsqueda.</p>`;
  list.querySelectorAll<HTMLButtonElement>("[data-original]").forEach((b) => b.addEventListener("click", () =>
    busy(b, async () => {
      await adminApi.saveText(b.dataset.original!, null, state.draft!.versiones.textos[b.dataset.original!] ?? null);
      await Promise.all([reloadDraft(), reloadPending()]);
      drawList(section);
      notify("El texto vuelve al original en el borrador. Publica para que se vea en el sitio.");
    })));
  renderPagination(section.querySelector("#textos-paginas")!, { total: rows.length, pagina: filters.pagina, porPagina: PAGE_SIZE }, (p) => {
    filters.pagina = p;
    drawList(section);
  });
}
