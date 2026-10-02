import { vigilarCambios } from "../../lib/cambios";
import { adminApi, type DraftWork } from "../../lib/data/http/admin-api";
import { uploadedUrl } from "../../lib/fotos";
import { STAGE_NAMES, workProgress } from "../../lib/obras";
import { busy, card, DRAFT_PILL, esc, field, GHOST, ICON_BUTTON, iconSvg, isPending, notify, reloadDraft, reloadPending, state, value } from "./ui";

const MAX_MILESTONES = 20;
const MAX_PHOTOS = 24;
const STAGE_CLASSES = { "por-iniciar": "border border-base-300 text-primary", "en-ejecucion": "bg-secondary text-primary", terminada: "bg-primary text-primary-content" };
let selected = "";
let work: DraftWork | null = null; // copia de trabajo de la obra abierta

const nameOf = (slug: string) => state.draft!.propuestas.find((p) => p.slug === slug)?.nombre ?? slug;

/** Lo que se guarda de una obra, para comparar la copia de trabajo con el borrador. */
const saved = (w: DraftWork) => ({ nota: w.nota, hitos: w.hitos, fotos: w.fotos.map((f) => ({ idMedio: f.idMedio, pie: f.pie })) });

/** Pasa a la copia de trabajo lo escrito en el formulario. */
function capture(form: HTMLElement) {
  work = {
    ...work!,
    nota: value(form, "#obra-nota"),
    hitos: [...form.querySelectorAll<HTMLElement>(".obra-hito")].map((row) => ({
      nombre: value(row, '[name="hito"]'), completado: row.querySelector<HTMLInputElement>('[name="completado"]')!.checked,
    })),
    fotos: work!.fotos.map((f, i) => ({ ...f, pie: value(form, `#foto-pie-${i}`) })),
  };
}

export function renderWorks(section: HTMLElement) {
  const works = state.draft!.obras;
  selected ||= works[0]?.slug ?? "";
  if (!work || work.slug !== selected) work = structuredClone(works.find((w) => w.slug === selected)!);
  const { percent, stage } = workProgress(work.hitos.map((h) => ({ done: h.completado })));
  const hitos = work.hitos.map((h, i) => `
    <div class="obra-hito flex items-center gap-2 border-t border-t-base-300 py-1.5 first:border-t-0">
      <input type="checkbox" name="completado" id="hito-completado-${i}" ${h.completado ? "checked" : ""} class="size-6 shrink-0 accent-neutral" aria-label="Hito ${i + 1} completado" />
      <input name="hito" value="${esc(h.nombre)}" maxlength="120" aria-label="Nombre del hito ${i + 1}" class="min-h-11 min-w-0 flex-1 rounded-[3px] border border-transparent px-2 text-[0.9rem] text-primary hover:border-[#acbacb] focus-visible:border-[#acbacb]" />
      <button type="button" class="${ICON_BUTTON}" data-mover="-1" data-indice="${i}" aria-label="Subir hito ${i + 1}" ${i === 0 ? "disabled" : ""}>${iconSvg("up", 18)}</button>
      <button type="button" class="${ICON_BUTTON}" data-mover="1" data-indice="${i}" aria-label="Bajar hito ${i + 1}" ${i === work!.hitos.length - 1 ? "disabled" : ""}>${iconSvg("chevron", 18)}</button>
      <button type="button" class="${ICON_BUTTON} text-error" data-quitar-hito="${i}" aria-label="Quitar hito ${i + 1}">${iconSvg("trash", 18)}</button>
    </div>`).join("");
  const fotos = work.fotos.map((f, i) => `
    <div class="flex flex-col gap-2">
      <div class="relative">
        <img src="${esc(uploadedUrl(f, f.anchos[0]))}" alt="" class="aspect-[4/3] w-full rounded-[4px] object-cover" />
        <button type="button" data-quitar-foto="${i}" aria-label="Quitar foto ${i + 1}" class="absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-[3px] bg-base-100 text-error">${iconSvg("trash", 17)}</button>
      </div>
      ${field({ id: `foto-pie-${i}`, label: "Pie de foto", value: f.pie, max: 200 })}
    </div>`).join("");
  const form = card(nameOf(work.slug), `
    ${isPending("Obra", nameOf(work.slug)) ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <div class="mb-6 flex items-center gap-4 border-l-4 border-l-neutral bg-[#eef4fb] px-4 py-4 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-2">
      <span class="font-display text-[2.4rem] leading-none font-bold">${percent} %</span>
      <div class="flex flex-1 flex-col gap-2">
        <span class="flex items-center justify-between gap-3 text-[0.78rem]"><strong>Avance</strong>
        <span class="rounded-full px-3 py-1 text-[0.66rem] font-bold tracking-[0.08em] uppercase ${STAGE_CLASSES[stage]}">${STAGE_NAMES[stage]}</span></span>
        <div class="h-2.5 overflow-hidden rounded-full bg-[#06317618]"><div class="h-full rounded-full bg-neutral" style="width: ${percent}%"></div></div>
      </div>
    </div>
    <form id="obra-form" class="grid grid-cols-2 items-start gap-7 max-tablet:grid-cols-1" novalidate>
      <div class="flex flex-col gap-[18px]">
        ${field({ id: "obra-nota", label: "Nota", value: work.nota, max: 600, area: true })}
        <div>
          <span class="block text-[0.82rem] font-bold">Hitos</span>
          <p class="m-0 mb-1.5 text-[0.74rem] text-[#50617d]">Marca cada fase cuando termine.</p>
          <div id="obra-hitos">${hitos}</div>
          <button type="button" id="hito-agregar" class="${GHOST} mt-2.5" ${work.hitos.length >= MAX_MILESTONES ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir hito</button>
        </div>
      </div>
      <div>
        <span class="mb-2.5 block text-[0.82rem] font-bold">Fotos de evidencia</span>
        <div class="grid grid-cols-2 gap-4 max-tablet:gap-2.5">
          ${fotos}
          <label class="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[#acbacb] p-2.5 text-center text-neutral ${work.fotos.length >= MAX_PHOTOS ? "hidden" : ""}">
            ${iconSvg("upload", 26)}<strong class="text-[0.82rem] text-primary">Subir fotos</strong>
            <span class="text-[0.7rem] text-[#50617d]">Varias a la vez · hasta 8 MB cada una · medida recomendada 595 × 495 px</span>
            <input id="obra-fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" />
          </label>
        </div>
      </div>
      <div class="col-span-2 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:col-span-1 max-tablet:flex-col-reverse">
        <a class="${GHOST}" href="/ciudadania/obras-en-ejecucion/">${iconSvg("eye", 18)} Ver en el sitio</a>
        <button type="submit" class="button">Guardar borrador</button>
      </div>
    </form>`);
  section.innerHTML = `
    <div class="mb-5 flex items-center gap-3.5 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-1.5">
      <label for="obra-selector" class="text-[0.82rem] font-bold">Obra</label>
      <select id="obra-selector" class="min-h-12 min-w-[320px] rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary max-tablet:min-w-0">
        ${state.draft!.obras.map((w) => `<option value="${esc(w.slug)}" ${w.slug === selected ? "selected" : ""}>${esc(nameOf(w.slug))}</option>`).join("")}
      </select>
    </div>
    ${form}`;
  bind(section);
}

function bind(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>("#obra-form")!;
  const edit = (change: () => void) => { capture(form); change(); renderWorks(section); };
  section.querySelector<HTMLSelectElement>("#obra-selector")!.addEventListener("change", (e) => {
    selected = (e.target as HTMLSelectElement).value;
    work = null;
    renderWorks(section);
  });
  form.querySelectorAll<HTMLInputElement>('[name="completado"]').forEach((c) => c.addEventListener("change", () => edit(() => {})));
  form.querySelector("#hito-agregar")!.addEventListener("click", () => edit(() => work!.hitos.push({ nombre: "", completado: false })));
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-hito]").forEach((b) => b.addEventListener("click", () =>
    edit(() => work!.hitos.splice(Number(b.dataset.quitarHito), 1))));
  form.querySelectorAll<HTMLButtonElement>("[data-mover]").forEach((b) => b.addEventListener("click", () => edit(() => {
    const i = Number(b.dataset.indice), j = i + Number(b.dataset.mover);
    [work!.hitos[i], work!.hitos[j]] = [work!.hitos[j], work!.hitos[i]];
  })));
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-foto]").forEach((b) => b.addEventListener("click", () =>
    edit(() => work!.fotos.splice(Number(b.dataset.quitarFoto), 1))));
  form.querySelector<HTMLInputElement>("#obra-fotos")!.addEventListener("change", (e) => {
    const files = [...((e.target as HTMLInputElement).files ?? [])].slice(0, MAX_PHOTOS - work!.fotos.length);
    if (!files.length) return;
    capture(form);
    const slug = work!.slug;
    void busy(null, async () => {
      for (const [i, file] of files.entries()) {
        notify(`Subiendo foto ${i + 1} de ${files.length}…`);
        // Primero la subida y después leer `work`: mientras sube, otra lectura del formulario puede
        // reemplazar la copia de trabajo, y la foto se añadiría a la lista vieja.
        const foto = await adminApi.upload(file);
        if (work?.slug !== slug) return notify("Cambiaste de obra mientras se subían las fotos; vuelve a subirlas en esa obra.", true);
        work.fotos.push({ ...foto, pie: "" });
        renderWorks(section);
      }
      notify("Fotos subidas. Escribe un pie para cada una y guarda el borrador.");
    });
  });
  vigilarCambios(form, form.querySelector("button[type=submit]")!, saved(state.draft!.obras.find((w) => w.slug === work!.slug)!), () => {
    capture(form);
    return saved(work!);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture(form);
    if (!work!.nota || work!.hitos.some((h) => !h.nombre) || work!.fotos.some((f) => !f.pie))
      return notify("Completa la nota, el nombre de cada hito y el pie de cada foto.", true);
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveWork(work!.slug, { nota: work!.nota, hitos: work!.hitos, fotos: work!.fotos.map((f) => ({ idMedio: f.idMedio, pie: f.pie })) },
        state.draft!.versiones.obras[work!.slug]);
      await Promise.all([reloadDraft(), reloadPending()]);
      work = null;
      renderWorks(section);
      notify(`Borrador de «${nameOf(selected)}» guardado. Publica para que se vea en el sitio.`);
    });
  });
}
