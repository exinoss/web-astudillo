import { adminApi, type DraftProposal } from "../../lib/data/http/admin-api";
import { busy, card, DRAFT_PILL, esc, field, GHOST, ICON_BUTTON, iconSvg, isPending, notify, reloadDraft, reloadPending, state, value } from "./ui";

const MAX_KPIS = 6;
let selected = "";

/** Fila editable de una cifra, con botones para ordenarla o quitarla. */
const kpiRow = (k: { etiqueta: string; valor: string }, i: number, total: number) => `
  <div class="kpi grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-end gap-3 border-t border-t-base-300 py-3 first:border-t-0 max-tablet:grid-cols-2">
    ${field({ id: `kpi-etiqueta-${i}`, name: "etiqueta", label: "Etiqueta", value: k.etiqueta, max: 60 })}
    ${field({ id: `kpi-valor-${i}`, name: "valor", label: "Cifra", value: k.valor, max: 30 })}
    <div class="flex justify-end max-tablet:col-span-2">
      <button type="button" class="${ICON_BUTTON}" data-mover="-1" data-indice="${i}" aria-label="Subir cifra ${i + 1}" ${i === 0 ? "disabled" : ""}>${iconSvg("up", 18)}</button>
      <button type="button" class="${ICON_BUTTON}" data-mover="1" data-indice="${i}" aria-label="Bajar cifra ${i + 1}" ${i === total - 1 ? "disabled" : ""}>${iconSvg("chevron", 18)}</button>
      <button type="button" class="${ICON_BUTTON} text-error" data-quitar="${i}" aria-label="Quitar cifra ${i + 1}">${iconSvg("trash", 18)}</button>
    </div>
  </div>`;

/** Lee del formulario las cifras tal como están escritas ahora. */
const readKpis = (form: HTMLElement) => [...form.querySelectorAll<HTMLElement>(".kpi")].map((row) => ({
  etiqueta: value(row, '[name="etiqueta"]'), valor: value(row, '[name="valor"]'),
}));

export function renderProposals(section: HTMLElement) {
  const proposals = state.draft!.propuestas;
  selected ||= proposals[0]?.slug ?? "";
  const current = proposals.find((p) => p.slug === selected)!;
  draw(section, proposals, current, current.kpis);
}

function draw(section: HTMLElement, proposals: DraftProposal[], current: DraftProposal, kpis: DraftProposal["kpis"]) {
  const list = proposals.map((p) => `
    <button type="button" data-propuesta="${esc(p.slug)}" aria-current="${p.slug === current.slug}"
      class="flex min-h-[52px] items-center justify-between gap-2.5 border-t border-t-base-300 border-l-4 border-l-transparent px-4 text-left text-[0.88rem] first:border-t-0 aria-[current=true]:border-l-secondary aria-[current=true]:bg-[#eef4fb] aria-[current=true]:font-bold">
      <span>${esc(p.nombre)}</span>${isPending("Propuesta", p.nombre) ? `<span class="${DRAFT_PILL}">Borrador</span>` : ""}
    </button>`).join("");
  const select = `
    <label for="propuesta-selector" class="mb-[7px] block text-[0.82rem] font-bold">Propuesta</label>
    <select id="propuesta-selector" class="min-h-12 w-full rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary">
      ${proposals.map((p) => `<option value="${esc(p.slug)}" ${p.slug === current.slug ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
    </select>`;
  const form = card(current.nombre, `
    ${isPending("Propuesta", current.nombre) ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="propuesta-form" class="flex flex-col gap-[18px]" novalidate>
      <div class="grid grid-cols-2 gap-4 max-tablet:grid-cols-1">
        ${field({ id: "propuesta-nombre", label: "Nombre", value: current.nombre, max: 120 })}
        ${field({ id: "propuesta-categoria", label: "Categoría", value: current.categoria, max: 80 })}
      </div>
      ${field({ id: "propuesta-intro", label: "Introducción", value: current.introduccion, max: 400, area: true })}
      <div>
        <h3 class="m-0 mt-2 mb-1 font-display text-[1.5rem] font-semibold">Cifras (KPI)</h3>
        <p class="m-0 mb-1.5 text-[0.8rem] text-[#50617d]">Se muestran bajo la cabecera de la propuesta, en este orden. Máximo ${MAX_KPIS}.</p>
        <div id="kpis">${kpis.map((k, i) => kpiRow(k, i, kpis.length)).join("")}</div>
        <button type="button" id="kpi-agregar" class="${GHOST} mt-3" ${kpis.length >= MAX_KPIS ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir cifra</button>
      </div>
      <div class="flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
        <a class="${GHOST}" href="/propuestas/${esc(current.slug)}/">${iconSvg("eye", 18)} Ver en el sitio</a>
        <button type="submit" class="button">Guardar borrador</button>
      </div>
    </form>`);
  section.innerHTML = `
    <div class="hidden max-tablet:mb-4 max-tablet:block">${select}</div>
    <div class="grid grid-cols-[300px_minmax(0,1fr)] items-start gap-6 max-tablet:grid-cols-1">
      <nav class="flex flex-col overflow-hidden rounded-[3px] border border-base-300 max-tablet:hidden" aria-label="Propuestas">${list}</nav>
      ${form}
    </div>`;

  const pick = (slug: string) => { selected = slug; renderProposals(section); };
  section.querySelectorAll<HTMLButtonElement>("[data-propuesta]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.propuesta!)));
  section.querySelector<HTMLSelectElement>("#propuesta-selector")!.addEventListener("change", (e) => pick((e.target as HTMLSelectElement).value));

  const formEl = section.querySelector<HTMLFormElement>("#propuesta-form")!;
  const redraw = (next: DraftProposal["kpis"]) => {
    const edited = { ...current, nombre: value(formEl, "#propuesta-nombre"), categoria: value(formEl, "#propuesta-categoria"), introduccion: value(formEl, "#propuesta-intro") };
    draw(section, proposals, edited, next);
  };
  formEl.querySelector("#kpi-agregar")!.addEventListener("click", () => redraw([...readKpis(formEl), { etiqueta: "", valor: "" }]));
  formEl.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach((b) => b.addEventListener("click", () =>
    redraw(readKpis(formEl).filter((_, i) => i !== Number(b.dataset.quitar)))));
  formEl.querySelectorAll<HTMLButtonElement>("[data-mover]").forEach((b) => b.addEventListener("click", () => {
    const list = readKpis(formEl);
    const i = Number(b.dataset.indice), j = i + Number(b.dataset.mover);
    [list[i], list[j]] = [list[j], list[i]];
    redraw(list);
  }));
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const body = {
      nombre: value(formEl, "#propuesta-nombre"), categoria: value(formEl, "#propuesta-categoria"),
      introduccion: value(formEl, "#propuesta-intro"), kpis: readKpis(formEl),
    };
    if (!body.nombre || !body.categoria || !body.introduccion || body.kpis.some((k) => !k.etiqueta || !k.valor))
      return notify("Completa todos los campos, también etiqueta y cifra de cada KPI.", true);
    void busy(formEl.querySelector("button[type=submit]"), async () => {
      await adminApi.saveProposal(current.slug, body, state.draft!.versiones.propuestas[current.slug]);
      await Promise.all([reloadDraft(), reloadPending()]);
      renderProposals(section);
      notify(`Borrador de «${body.nombre}» guardado. Publica para que se vea en el sitio.`);
    });
  });
}
