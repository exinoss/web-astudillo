import { vigilarCambios } from "../../lib/cambios";
import {
  adminApi, type ParticipationKind, type ParticipationPage, type ParticipationState, type ReviewedAlert, type ReviewedSuggestion,
} from "../../lib/data/http/admin-api";
import { renderPagination } from "../../lib/paginacion";
import { ESTADOS, TIPOS_ALERTA } from "../../lib/participacion/tipos";
import { busy, can, card, esc, iconSvg, notify, PILL, state } from "./ui";

const view = { tipo: "alertas" as ParticipationKind, estado: "" as ParticipationState | "", pagina: 1 };
const STATES = Object.keys(ESTADOS) as ParticipationState[];
const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" });
const TAB = "relative min-h-11 py-3 text-[0.85rem] font-bold text-neutral aria-selected:text-primary aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:-bottom-px aria-selected:after:h-[3px] aria-selected:after:bg-secondary aria-selected:after:content-['']";
const CHIP = "min-h-11 rounded-full border border-base-300 bg-base-100 px-3.5 text-[0.78rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-content";

const topicName = (slug: string) => slug === "otro" ? "Otra idea" : state.draft!.propuestas.find((p) => p.slug === slug)?.nombre ?? slug;

const stateControl = (id: number, current: ParticipationState) => can("participacion.gestionar") ? `
  <span class="flex flex-wrap items-center gap-2" data-estado-de="${id}" data-actual="${current}">
    <label class="sr-only" for="estado-${id}">Estado</label>
    <select id="estado-${id}" class="min-h-11 rounded-[3px] border border-field-border bg-base-100 px-3 text-sm text-primary">
      ${STATES.map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${ESTADOS[s].nombre}</option>`).join("")}
    </select>
    <button type="button" class="button min-h-11 px-4 py-0">Guardar</button>
  </span>` : `<span class="${PILL} ${ESTADOS[current].clases}">${ESTADOS[current].nombre}</span>`;

function alertItem(a: ReviewedAlert) {
  const tipo = TIPOS_ALERTA.find((t) => t.valor === a.tipo)!;
  const thumb = a.foto
    ? `<a href="${esc(a.foto.grande)}" target="_blank" rel="noopener" aria-label="Ver la foto en grande"><img class="size-[72px] rounded-[4px] object-cover max-tablet:size-14" src="${esc(a.foto.miniatura)}" alt="Foto enviada con la alerta" loading="lazy" /></a>`
    : `<span class="grid size-[72px] place-items-center rounded-[4px] bg-[#eef2f8] text-neutral max-tablet:size-14">${iconSvg(tipo.icono, 28)}</span>`;
  return `<li class="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-3.5 border-t border-t-base-300 py-4 first:border-t-0 max-tablet:grid-cols-[56px_minmax(0,1fr)]">
    ${thumb}
    <div class="min-w-0">
      <strong class="flex items-center gap-1.5 text-[0.92rem]">${iconSvg(tipo.icono, 18)} ${esc(tipo.nombre)} · ${esc(a.sector)}</strong>
      <p class="mt-1 mb-0 text-[0.84rem] leading-normal [overflow-wrap:anywhere]">${esc(a.descripcion)}</p>
      <small class="text-[0.72rem] text-[#50617d]">${esc(a.autor ?? a.correo)} · ${date.format(new Date(a.creadoEn))}${a.referencia ? ` · Ref.: ${esc(a.referencia)}` : ""}</small>
    </div>
    <div class="max-tablet:col-span-2">${stateControl(a.id, a.estado)}</div>
  </li>`;
}

function suggestionItem(s: ReviewedSuggestion) {
  return `<li class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3.5 border-t border-t-base-300 py-4 first:border-t-0 max-tablet:grid-cols-1">
    <div class="min-w-0">
      <strong class="text-[0.92rem]">${esc(topicName(s.tema))}</strong>
      <p class="mt-1 mb-0 text-[0.84rem] leading-normal whitespace-pre-line [overflow-wrap:anywhere]">${esc(s.mensaje)}</p>
      <small class="text-[0.72rem] text-[#50617d]">${esc(s.autor ?? s.correo)} · ${date.format(new Date(s.creadoEn))}</small>
    </div>
    <div>${stateControl(s.id, s.estado)}</div>
  </li>`;
}

export async function renderParticipation(section: HTMLElement) {
  const data = await adminApi.participation<ReviewedAlert | ReviewedSuggestion>(view.tipo, view.pagina, view.estado || undefined);
  const counts = data.conteo[view.tipo];
  const all = STATES.reduce((sum, s) => sum + counts[s], 0);
  const total = (kind: ParticipationKind) => STATES.reduce((sum, s) => sum + data.conteo[kind][s], 0);
  const list = data.items.length
    ? `<ul class="m-0 list-none p-0">${data.items.map((item) => view.tipo === "alertas" ? alertItem(item as ReviewedAlert) : suggestionItem(item as ReviewedSuggestion)).join("")}</ul>`
    : `<p class="m-0 py-4 text-[0.86rem]">No hay ${view.tipo} en este estado.</p>`;
  section.innerHTML = card("", `
    <div class="flex gap-7 whitespace-nowrap" role="tablist" aria-label="Tipo">
      ${(["alertas", "sugerencias"] as const).map((k) => `<button type="button" role="tab" class="${TAB}" data-tipo="${k}" aria-selected="${k === view.tipo}">${k === "alertas" ? "Alertas" : "Sugerencias"} (${total(k)})</button>`).join("")}
    </div>
    <div class="mt-3 mb-1.5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      <button type="button" class="${CHIP}" data-filtro="" aria-pressed="${!view.estado}">Todas (${all})</button>
      ${STATES.map((s) => `<button type="button" class="${CHIP}" data-filtro="${s}" aria-pressed="${view.estado === s}">${ESTADOS[s].nombre} (${counts[s]})</button>`).join("")}
    </div>
    ${list}
    <div id="participacion-paginas"></div>`);
  bind(section, data);
}

function bind(section: HTMLElement, data: ParticipationPage<unknown>) {
  const reload = () => void renderParticipation(section).catch((e) => notify(e instanceof Error ? e.message : "No se pudo cargar.", true));
  section.querySelectorAll<HTMLButtonElement>("[data-tipo]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(view, { tipo: b.dataset.tipo, estado: "", pagina: 1 });
    reload();
  }));
  section.querySelectorAll<HTMLButtonElement>("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(view, { estado: b.dataset.filtro, pagina: 1 });
    reload();
  }));
  section.querySelectorAll<HTMLElement>("[data-estado-de]").forEach((control) => {
    const select = control.querySelector("select")!;
    const button = control.querySelector("button")!;
    const before = control.dataset.actual as ParticipationState;
    vigilarCambios(control, button, before, () => select.value);
    // Se envía el estado que se veía: si otra persona lo cambió mientras tanto, la API responde 409.
    button.addEventListener("click", () => void busy(button, async () => {
      await adminApi.changeParticipationState(view.tipo, Number(control.dataset.estadoDe), select.value as ParticipationState, before);
      await renderParticipation(section);
      notify(`Estado actualizado a «${ESTADOS[select.value as ParticipationState].nombre}».`);
    }));
  });
  const filtered = view.estado ? data.conteo[view.tipo][view.estado] : STATES.reduce((sum, s) => sum + data.conteo[view.tipo][s], 0);
  renderPagination(section.querySelector("#participacion-paginas")!, { total: filtered, pagina: data.pagina, porPagina: data.porPagina }, (p) => {
    view.pagina = p;
    reload();
  });
}
