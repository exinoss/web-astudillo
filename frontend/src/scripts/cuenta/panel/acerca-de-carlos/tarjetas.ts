import { cardMarkup } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/tarjeta";
import { cardImageUrl } from "../../../../lib/comun/fotos";
import { esc, field, HINT, LABEL, value } from "../ui";
import { bindListActions, MAX_ITEMS, moveButtons, onFiles, radios, upload, type Editor, type SectionEditor } from "./comun";

let selectedCard = 0;

function cardPreview(editor: Editor) {
  const card = editor.page.tarjetas[selectedCard];
  return cardMarkup({ title: card.titulo || "Título", text: card.texto, alt: card.alt, color: card.color, focus: card.enfoque, src: cardImageUrl(card.foto) },
    selectedCard + 1, "tarjeta-vista");
}

export const cards: SectionEditor = {
  html(editor: Editor) {
    const list = editor.page.tarjetas;
    selectedCard = Math.min(selectedCard, Math.max(0, list.length - 1));
    const card = list[selectedCard];
    const items = list.map((c, i) => `<button type="button" data-card-select="${i}" aria-pressed="${i === selectedCard}" class="min-h-14 w-full rounded-[3px] border border-base-300 border-l-4 p-3 text-left text-[0.8rem] font-bold aria-pressed:border-l-secondary aria-pressed:bg-[#fffbe8] [overflow-wrap:anywhere]">${i + 1} · ${esc(c.titulo || "Nueva tarjeta")}</button>`).join("");
    const add = list.length < MAX_ITEMS ? `<div class="mt-3">${upload("tarjeta-nueva", "Añadir tarjeta")}</div>` : "";
    const editorHtml = card ? `
      <div class="flex min-w-0 flex-col gap-[18px]">
        ${field({ id: "tarjeta-titulo", label: "Título", value: card.titulo, max: 60, hint: "Hasta 60 caracteres." })}
        ${field({ id: "tarjeta-texto", label: "Texto", value: card.texto, max: 180, area: true, hint: "Hasta 180 caracteres. Se lee al pulsar «Leer más»." })}
        ${field({ id: "tarjeta-alt", label: "Descripción de la foto", value: card.alt, max: 200 })}
        <div>
          <span class="${LABEL}">Foto</span>
          ${upload("tarjeta-foto", "Cambiar foto")}
          <p class="${HINT}">Medida recomendada: 800 × 1170 px (vertical). JPG, PNG o WebP de hasta 8 MB. Mejor una escena o un detalle que represente la idea.</p>
        </div>
        <fieldset class="min-w-0 rounded-[3px] border border-base-300 p-4">
          <legend class="px-1 text-[0.82rem] font-bold">Encuadre</legend>
          <div class="grid grid-cols-2 gap-4 max-tablet:grid-cols-1">
            <div><label for="tarjeta-x" class="block text-[0.8rem]">Horizontal</label><input id="tarjeta-x" type="range" min="0" max="100" value="${card.enfoque.x}" class="min-h-11 w-full accent-primary" /></div>
            <div><label for="tarjeta-y" class="block text-[0.8rem]">Vertical</label><input id="tarjeta-y" type="range" min="0" max="100" value="${card.enfoque.y}" class="min-h-11 w-full accent-primary" /></div>
          </div>
        </fieldset>
        <fieldset class="min-w-0 rounded-[3px] border border-base-300 p-4">
          <legend class="px-1 text-[0.82rem] font-bold">Color de la tarjeta</legend>
          <div class="flex flex-wrap gap-3">${radios("tarjeta-color", [
            ["rojo", "Rojo", '<span aria-hidden="true" class="size-6 rounded-full bg-[#d81919]"></span>'],
            ["azul", "Azul", '<span aria-hidden="true" class="size-6 rounded-full bg-[#284e9c]"></span>'],
          ], card.color)}</div>
        </fieldset>
        <div class="flex flex-wrap gap-1 border-t border-base-300 pt-3">${moveButtons("tarjeta", selectedCard, list.length, `tarjeta ${selectedCard + 1}`)}</div>
      </div>
      <aside class="min-w-0 max-laptop:row-start-1" aria-label="Vista previa de la tarjeta">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <strong class="text-[0.85rem]">Vista previa</strong>
          <div class="flex gap-1">
            <button data-preview-width="260" type="button" aria-pressed="true" class="min-h-11 rounded-[3px] border border-base-300 px-2 text-[0.72rem] aria-pressed:bg-accent">Escritorio</button>
            <button data-preview-width="200" type="button" aria-pressed="false" class="min-h-11 rounded-[3px] border border-base-300 px-2 text-[0.72rem] aria-pressed:bg-accent">Móvil</button>
          </div>
        </div>
        <div id="tarjeta-vista" class="mx-auto w-full max-w-[260px]">${cardPreview(editor)}</div>
        <p class="mt-3 mb-0 text-center text-[0.75rem]">Tarjeta ${selectedCard + 1} de ${list.length}</p>
      </aside>` : `<p class="m-0 text-[0.9rem]">Añade la primera tarjeta eligiendo su foto.</p>`;
    return `<div class="grid grid-cols-[190px_minmax(0,1fr)] gap-6 max-tablet:grid-cols-1">
      <div class="min-w-0"><div class="flex flex-col gap-2">${items}</div>${add}<p class="${HINT}">Hasta ${MAX_ITEMS} tarjetas. Foto de 800 × 1170 px (vertical).</p></div>
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] items-start gap-6 max-laptop:grid-cols-1">${editorHtml}</div>
    </div>`;
  },
  capture(form: HTMLElement, editor: Editor) {
    const card = editor.page.tarjetas[selectedCard];
    if (!card || !form.querySelector("#tarjeta-titulo")) return;
    card.titulo = value(form, "#tarjeta-titulo");
    card.texto = value(form, "#tarjeta-texto");
    card.alt = value(form, "#tarjeta-alt");
    card.enfoque = { x: Number(value(form, "#tarjeta-x")), y: Number(value(form, "#tarjeta-y")) };
    card.color = (form.querySelector<HTMLInputElement>('[name="tarjeta-color"]:checked')?.value ?? card.color) as "rojo" | "azul";
  },
  bind(form: HTMLElement, editor: Editor) {
    const capture = () => cards.capture(form, editor);
    form.querySelectorAll<HTMLButtonElement>("[data-card-select]").forEach((b) => b.addEventListener("click", () => {
      capture();
      selectedCard = Number(b.dataset.cardSelect);
      editor.rerender();
    }));
    const color = editor.slug === "conoce-mas" ? "azul" : "rojo";
    onFiles(form.querySelector("#tarjeta-nueva"), MAX_ITEMS - editor.page.tarjetas.length, (foto) => {
      editor.page.tarjetas.push({ foto, alt: "", titulo: "", texto: "", color, enfoque: { x: 50, y: 50 } });
      selectedCard = editor.page.tarjetas.length - 1;
    }, editor, capture);
    onFiles(form.querySelector("#tarjeta-foto"), 1, (foto) => { editor.page.tarjetas[selectedCard].foto = foto; }, editor, capture);
    bindListActions(form, editor, capture, (index) => { selectedCard = index; });
    const preview = form.querySelector<HTMLElement>("#tarjeta-vista");
    if (!preview) return;
    let layout = "desktop";
    const refresh = () => {
      capture();
      preview.innerHTML = cardPreview(editor);
      preview.querySelector<HTMLElement>("[data-carlos-card]")!.dataset.layout = layout;
      const label = form.querySelector(`[data-card-select="${selectedCard}"]`);
      if (label) label.textContent = `${selectedCard + 1} · ${editor.page.tarjetas[selectedCard].titulo || "Nueva tarjeta"}`;
    };
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.querySelectorAll<HTMLButtonElement>("[data-preview-width]").forEach((b) => b.addEventListener("click", () => {
      preview.style.maxWidth = `${b.dataset.previewWidth}px`;
      layout = b.dataset.previewWidth === "200" ? "mobile" : "desktop";
      form.querySelectorAll("[data-preview-width]").forEach((other) => other.setAttribute("aria-pressed", String(other === b)));
      refresh();
    }));
  },
};
