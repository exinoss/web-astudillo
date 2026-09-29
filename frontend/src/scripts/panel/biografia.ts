import { adminApi, type DraftBiographyItem } from "../../lib/data/http/admin-api";
import { uploadedUrl } from "../../lib/fotos";
import { busy, card, DANGER, DRAFT_PILL, esc, field, GHOST, iconSvg, isPending, notify, reloadDraft, reloadPending, state, value } from "./ui";

const MAX_ITEMS = 30;
// Copia de trabajo: la línea de tiempo se edita entera y se guarda de una vez (orden incluido).
let items: DraftBiographyItem[] | null = null;
let selected = 0;

const photoPreview = (item: DraftBiographyItem, big = false) => item.foto
  ? `<img src="${esc(uploadedUrl(item.foto, item.foto.anchos[0]))}" alt="" class="${big ? "aspect-[4/3] w-full rounded-[12px]" : "h-11 w-16 rounded-[4px]"} object-cover" />`
  : `<span class="${big ? "aspect-[4/3] w-full rounded-[12px] text-[0.8rem]" : "h-11 w-16 rounded-[4px] text-[0.6rem]"} grid place-items-center border border-dashed border-neutral/35 bg-neutral/8 font-bold text-neutral">Sin foto</span>`;

/** Guarda en la copia de trabajo lo escrito en el formulario del hito abierto. */
function capture(form: HTMLElement) {
  if (!items?.[selected]) return;
  items[selected] = {
    ...items[selected], anios: value(form, "#hito-anios"), titulo: value(form, "#hito-titulo"),
    texto: value(form, "#hito-texto"), alt: value(form, "#hito-alt") || null,
  };
}

export function renderBiography(section: HTMLElement) {
  items ??= structuredClone(state.draft!.biografia);
  selected = Math.min(selected, Math.max(0, items.length - 1));
  const item = items[selected];
  const list = items.map((h, i) => `
    <button type="button" data-hito="${i}" aria-current="${i === selected}"
      class="flex w-full items-center gap-3 rounded-[3px] border border-base-300 border-l-4 p-2.5 text-left aria-[current=true]:border-secondary aria-[current=true]:bg-[#fffbe8]">
      ${photoPreview(h)}
      <span class="flex min-w-0 flex-col"><strong class="font-display text-[1.2rem] text-neutral">${esc(h.anios || "Sin años")}</strong>
      <span class="truncate text-[0.8rem]">${esc(h.titulo || "Hito sin título")}</span></span>
    </button>`).join("");
  const order = `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="${GHOST}" data-orden="-1" ${selected === 0 ? "disabled" : ""}>${iconSvg("up", 18)} Subir</button>
      <button type="button" class="${GHOST}" data-orden="1" ${selected >= items.length - 1 ? "disabled" : ""}>${iconSvg("chevron", 18)} Bajar</button>
      <button type="button" class="${GHOST}" id="hito-agregar" ${items.length >= MAX_ITEMS ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir hito</button>
    </div>`;
  const form = !item ? card("Sin hitos", `<p class="m-0">Añade el primer hito de la línea de tiempo.</p>`) : card(item.titulo || "Nuevo hito", `
    ${isPending("Biografía", "Línea de tiempo") ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="hito-form" class="flex flex-col gap-[18px]" novalidate>
      <div class="grid grid-cols-[180px_minmax(0,1fr)] gap-4 max-tablet:grid-cols-1">
        ${field({ id: "hito-anios", label: "Años", value: item.anios, max: 40 })}
        ${field({ id: "hito-titulo", label: "Título", value: item.titulo, max: 120 })}
      </div>
      ${field({ id: "hito-texto", label: "Texto", value: item.texto, max: 3000, area: true, hint: "Deja una línea en blanco para separar párrafos." })}
      <div>
        <span class="mb-[7px] block text-[0.82rem] font-bold">Foto</span>
        <div class="grid grid-cols-[260px_minmax(0,1fr)] items-center gap-4 max-nav:grid-cols-1">
          ${photoPreview(item, true)}
          <div class="flex flex-col gap-2">
            <label class="${GHOST} cursor-pointer self-start max-tablet:self-stretch">${iconSvg("upload", 18)} ${item.foto ? "Cambiar foto" : "Subir foto"}
              <input id="hito-foto" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" /></label>
            <p class="m-0 text-[0.74rem] text-[#50617d]">JPG, PNG o WebP de hasta 8 MB. Se optimiza y se le quitan los datos de ubicación.</p>
            ${item.foto ? `<button type="button" id="hito-quitar-foto" class="${GHOST} self-start">Quitar foto</button>` : ""}
          </div>
        </div>
      </div>
      ${item.foto ? field({ id: "hito-alt", label: "Descripción de la foto", value: item.alt ?? "", max: 200, hint: "La leen los lectores de pantalla. Describe lo que se ve." }) : ""}
      <div class="flex flex-wrap justify-between gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
        <button type="button" id="hito-eliminar" class="${DANGER}">${iconSvg("trash", 18)} Eliminar hito</button>
        <span class="flex flex-wrap gap-2.5 max-tablet:flex-col-reverse">
          <a class="${GHOST}" href="/acerca-de-nosotros/biografia/">${iconSvg("eye", 18)} Ver en el sitio</a>
          <button type="submit" class="button">Guardar borrador</button>
        </span>
      </div>
    </form>`);
  section.innerHTML = `
    <div class="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-6 max-nav:grid-cols-[240px_minmax(0,1fr)] max-tablet:grid-cols-1">
      <div class="flex flex-col gap-2.5">
        <label for="hito-selector" class="hidden text-[0.82rem] font-bold max-tablet:block">Hito ${selected + 1} de ${items.length}</label>
        <select id="hito-selector" class="hidden min-h-12 w-full rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary max-tablet:block">
          ${items.map((h, i) => `<option value="${i}" ${i === selected ? "selected" : ""}>${esc(`${h.anios} · ${h.titulo}`)}</option>`).join("")}
        </select>
        <div class="flex flex-col gap-2.5 max-tablet:hidden">${list}</div>
        ${order}
      </div>
      ${form}
    </div>`;
  bind(section);
}

function bind(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>("#hito-form");
  const go = (next: () => void) => { if (form) capture(form); next(); renderBiography(section); };
  section.querySelectorAll<HTMLButtonElement>("[data-hito]").forEach((b) => b.addEventListener("click", () => go(() => { selected = Number(b.dataset.hito); })));
  section.querySelector<HTMLSelectElement>("#hito-selector")?.addEventListener("change", (e) => go(() => { selected = Number((e.target as HTMLSelectElement).value); }));
  section.querySelectorAll<HTMLButtonElement>("[data-orden]").forEach((b) => b.addEventListener("click", () => go(() => {
    const j = selected + Number(b.dataset.orden);
    [items![selected], items![j]] = [items![j], items![selected]];
    selected = j;
  })));
  section.querySelector("#hito-agregar")?.addEventListener("click", () => go(() => {
    items!.push({ anios: "", titulo: "", texto: "", foto: null, alt: null });
    selected = items!.length - 1;
  }));
  if (!form) return;
  form.querySelector("#hito-eliminar")!.addEventListener("click", () => go(() => { items!.splice(selected, 1); }));
  form.querySelector("#hito-quitar-foto")?.addEventListener("click", () => go(() => { items![selected] = { ...items![selected], foto: null, alt: null }; }));
  form.querySelector<HTMLInputElement>("#hito-foto")!.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    capture(form);
    void busy(null, async () => {
      notify("Subiendo la foto…");
      const foto = await adminApi.upload(file);
      items![selected] = { ...items![selected], foto };
      renderBiography(section);
      notify("Foto subida. Describe lo que se ve y guarda el borrador.");
    });
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture(form);
    const incomplete = items!.findIndex((h) => !h.anios || !h.titulo || !h.texto || (h.foto && !h.alt));
    if (incomplete >= 0) {
      selected = incomplete;
      renderBiography(section);
      return notify("Completa años, título, texto y la descripción de la foto de cada hito.", true);
    }
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveBiography(items!.map((h) => ({ anios: h.anios, titulo: h.titulo, texto: h.texto, idMedio: h.foto?.idMedio ?? null, alt: h.alt })));
      await Promise.all([reloadDraft(), reloadPending()]);
      items = null;
      renderBiography(section);
      notify("Borrador de la biografía guardado. Publica para que se vea en el sitio.");
    });
  });
}
