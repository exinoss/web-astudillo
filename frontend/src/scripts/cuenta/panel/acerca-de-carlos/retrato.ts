import { uploadedUrl } from "../../../../lib/comun/fotos";
import { DANGER, esc, field, HINT, iconSvg, value } from "../ui";
import { onFiles, upload, type Editor, type SectionEditor } from "./comun";

export const portrait: SectionEditor = {
  html(editor: Editor) {
    const r = editor.page.retrato;
    if (!r) return `<p class="mt-0 text-[0.9rem]">Sin retrato, la presentación ocupa todo el ancho.</p>${upload("retrato-foto", "Subir retrato")}<p class="${HINT}">Medida recomendada: 800 × 1000 px (vertical), con un fondo distinto al amarillo del sitio. JPG, PNG o WebP de hasta 8 MB.</p>`;
    return `<div class="flex flex-wrap items-start gap-6">
      <img src="${esc(uploadedUrl(r.foto, r.foto.anchos[0]))}" alt="" class="aspect-[4/5] w-40 rounded-[12px] object-cover object-top" />
      <div class="flex min-w-[240px] flex-1 flex-col gap-[18px]">
        ${field({ id: "retrato-alt", label: "Descripción de la foto", value: r.alt, max: 200 })}
        <div class="flex flex-wrap gap-2">${upload("retrato-foto", "Cambiar retrato")}<button type="button" data-portrait-remove class="${DANGER}">${iconSvg("trash", 17)} Quitar retrato</button></div>
      </div>
    </div>`;
  },
  capture(form: HTMLElement, editor: Editor) {
    if (editor.page.retrato && form.querySelector("#retrato-alt")) editor.page.retrato.alt = value(form, "#retrato-alt");
  },
  bind(form: HTMLElement, editor: Editor) {
    const capture = () => portrait.capture(form, editor);
    onFiles(form.querySelector("#retrato-foto"), 1, (foto) => { editor.page.retrato = { foto, alt: editor.page.retrato?.alt ?? "" }; }, editor, capture);
    form.querySelector("[data-portrait-remove]")?.addEventListener("click", () => { editor.page.retrato = null; editor.rerender(); });
  },
};
