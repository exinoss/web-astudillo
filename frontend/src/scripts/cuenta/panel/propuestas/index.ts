import { vigilarCambios } from "../../../../lib/comun/cambios";
import { adminApi, type DraftProposal } from "../../../../lib/data/http/admin-api";
import { acciones, avisarVacios, avisoBorrador, busy, card, DRAFT_PILL, enlazarLista, esc, field, GHOST, guardarYRecargar, iconSvg, isPending, LABEL, LARGOS, moveButtons, state, value } from "../ui";

const MAX_KPIS = 6;
let selected = "";
// Una copia por propuesta: cambiar de propuesta no pierde lo escrito.
const trabajo: Record<string, DraftProposal> = {};

/** Fila editable de una cifra, con botones para ordenarla o quitarla. */
const kpiRow = (k: { etiqueta: string; valor: string }, i: number, total: number) => `
  <div class="kpi grid grid-cols-[repeat(2,minmax(0,1fr))_auto] items-start gap-3 border-t border-t-base-300 py-3 first:border-t-0 contenedor-estrecho:grid-cols-[minmax(0,1fr)_auto] contenedor-estrecho:[&>:first-child]:col-span-full contenedor-minimo:grid-cols-1">
    ${field({ id: `kpi-etiqueta-${i}`, name: "etiqueta", label: "Etiqueta", value: k.etiqueta, max: LARGOS.propuesta.etiquetaCifra , required: true })}
    ${field({ id: `kpi-valor-${i}`, name: "valor", label: "Cifra", value: k.valor, max: LARGOS.propuesta.valorCifra , required: true })}
    <div>
      <span class="${LABEL} invisible contenedor-minimo:hidden" aria-hidden="true">&nbsp;</span>
      <div class="flex min-h-12 items-end contenedor-minimo:min-h-0 contenedor-minimo:justify-end">
        ${moveButtons("cifra", i, total, `cifra ${i + 1}`)}
      </div>
    </div>
  </div>`;

const readKpis = (form: HTMLElement) => [...form.querySelectorAll<HTMLElement>(".kpi")].map((row) => ({
  etiqueta: value(row, '[name="etiqueta"]'), valor: value(row, '[name="valor"]'),
}));

export function renderProposals(section: HTMLElement) {
  const proposals = state.draft!.propuestas;
  selected ||= proposals[0]?.slug ?? "";
  draw(section, proposals, (trabajo[selected] ??= structuredClone(proposals.find((p) => p.slug === selected)!)));
}

/** Pinta la lista de propuestas y el formulario de la copia de trabajo de la elegida. */
function draw(section: HTMLElement, proposals: DraftProposal[], current: DraftProposal) {
  const { kpis } = current;
  const list = proposals.map((p) => `
    <button type="button" data-propuesta="${esc(p.slug)}" aria-current="${p.slug === current.slug}"
      class="flex min-h-[52px] items-center justify-between gap-2.5 border-t border-t-base-300 border-l-4 border-l-transparent px-4 text-left text-[0.88rem] first:border-t-0 aria-[current=true]:border-l-secondary aria-[current=true]:bg-primary-soft aria-[current=true]:font-bold">
      <span>${esc(p.nombre)}</span>${isPending("Propuesta", p.nombre) ? `<span class="${DRAFT_PILL}">Borrador</span>` : ""}
    </button>`).join("");
  const select = `
    <label for="propuesta-selector" class="mb-[7px] block text-[0.82rem] font-bold">Propuesta</label>
    <select id="propuesta-selector" class="campo">
      ${proposals.map((p) => `<option value="${esc(p.slug)}" ${p.slug === current.slug ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
    </select>`;
  const form = card(current.nombre, `
    ${avisoBorrador(isPending("Propuesta", current.nombre))}
    <form id="propuesta-form" class="flex flex-col gap-[18px]" novalidate>
      <div class="grid grid-cols-2 gap-4 max-tablet:grid-cols-1">
        ${field({ id: "propuesta-nombre", label: "Nombre", value: current.nombre, max: LARGOS.propuesta.nombre , required: true })}
        ${field({ id: "propuesta-categoria", label: "Categoría", value: current.categoria, max: LARGOS.propuesta.categoria , required: true })}
      </div>
      ${field({ id: "propuesta-intro", label: "Introducción", value: current.introduccion, max: LARGOS.propuesta.introduccion, area: true , required: true })}
      <div>
        <h3 class="m-0 mt-2 mb-1 font-display text-[1.5rem] font-semibold">Cifras (KPI)</h3>
        <p class="m-0 mb-1.5 text-[0.8rem] text-muted">Se muestran bajo la cabecera de la propuesta, en este orden. Máximo ${MAX_KPIS}.</p>
        <div id="kpis" class="@container">${kpis.map((k, i) => kpiRow(k, i, kpis.length)).join("")}</div>
        <button type="button" id="kpi-agregar" class="${GHOST} mt-3" ${kpis.length >= MAX_KPIS ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir cifra</button>
      </div>
      ${acciones(`/propuestas/${current.slug}/`)}
    </form>`);
  section.innerHTML = `
    <div class="hidden max-tablet:mb-4 max-tablet:block">${select}</div>
    <div class="grid grid-cols-[300px_minmax(0,1fr)] items-start gap-6 max-tablet:grid-cols-1">
      <nav class="flex flex-col overflow-hidden rounded-control border border-base-300 max-tablet:hidden" aria-label="Propuestas">${list}</nav>
      ${form}
    </div>`;

  const formEl = section.querySelector<HTMLFormElement>("#propuesta-form")!;
  const read = () => ({
    nombre: value(formEl, "#propuesta-nombre"), categoria: value(formEl, "#propuesta-categoria"),
    introduccion: value(formEl, "#propuesta-intro"), kpis: readKpis(formEl),
  });
  const pick = (slug: string) => { Object.assign(current, read()); selected = slug; renderProposals(section); };
  section.querySelectorAll<HTMLButtonElement>("[data-propuesta]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.propuesta!)));
  section.querySelector<HTMLSelectElement>("#propuesta-selector")!.addEventListener("change", (e) => pick((e.target as HTMLSelectElement).value));

  const redraw = (next: DraftProposal["kpis"]) => {
    Object.assign(current, read(), { kpis: next });
    draw(section, proposals, current);
  };
  formEl.querySelector("#kpi-agregar")!.addEventListener("click", () => redraw([...readKpis(formEl), { etiqueta: "", valor: "" }]));
  let filas: ReturnType<typeof readKpis> = [];
  enlazarLista(formEl, () => filas, (mutar) => {
    filas = readKpis(formEl);
    mutar();
    redraw(filas);
  });
  const saved = proposals.find((p) => p.slug === current.slug)!;
  vigilarCambios(formEl, formEl.querySelector("button[type=submit]")!,
    { nombre: saved.nombre, categoria: saved.categoria, introduccion: saved.introduccion, kpis: saved.kpis }, read);
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const body = read();
    if (!body.nombre || !body.categoria || !body.introduccion || body.kpis.some((k) => !k.etiqueta || !k.valor))
      return avisarVacios(formEl, "Completa todos los campos, también etiqueta y cifra de cada KPI.");
    void busy(formEl.querySelector("button[type=submit]"), () => guardarYRecargar(
      () => adminApi.saveProposal(current.slug, body, state.draft!.versiones.propuestas[current.slug]), () => {
        delete trabajo[current.slug];
        renderProposals(section);
      }));
  });
}
