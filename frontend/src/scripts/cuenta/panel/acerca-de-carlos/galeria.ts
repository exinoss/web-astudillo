import { esc, field, HINT, value } from "../ui";
import { bindListActions, MAX_ITEMS, moveButtons, onFiles, thumb, upload, type Editor, type SectionEditor } from "./comun";

export const gallery: SectionEditor = {
  html(editor: Editor) {
    const list = editor.page.galeria;
    const items = list.map((g, i) => `
      <div class="flex min-w-0 flex-col gap-3 rounded-[3px] border border-base-300 p-3">
        <img src="${esc(thumb(g.foto))}" alt="" class="aspect-[4/3] w-full rounded-[3px] object-cover" />
        ${field({ id: `galeria-alt-${i}`, label: "Descripción de la foto", value: g.alt, max: 200 })}
        ${field({ id: `galeria-pie-${i}`, label: "Pie de foto", value: g.pie, max: 200 })}
        <div class="flex flex-wrap gap-1">${moveButtons("foto", i, list.length, `foto ${i + 1}`)}</div>
      </div>`).join("");
    return `<div class="grid grid-cols-3 gap-4 max-laptop:grid-cols-2 max-tablet:grid-cols-1">${items}</div>
      ${list.length < MAX_ITEMS ? `<div class="mt-4">${upload("galeria-fotos", "Subir fotos", true)}</div>` : ""}
      <p class="${HINT}">Hasta ${MAX_ITEMS} fotos. Medida recomendada: 1600 × 1200 px (horizontal). Usa fotos, no piezas con texto: en el collage se recortan.</p>`;
  },
  capture(form: HTMLElement, editor: Editor) {
    editor.page.galeria.forEach((g, i) => {
      if (!form.querySelector(`#galeria-alt-${i}`)) return;
      g.alt = value(form, `#galeria-alt-${i}`);
      g.pie = value(form, `#galeria-pie-${i}`);
    });
  },
  bind(form: HTMLElement, editor: Editor) {
    const capture = () => gallery.capture(form, editor);
    onFiles(form.querySelector("#galeria-fotos"), MAX_ITEMS - editor.page.galeria.length, (foto) => editor.page.galeria.push({ foto, alt: "", pie: "" }), editor, capture);
    bindListActions(form, editor, capture);
  },
};
