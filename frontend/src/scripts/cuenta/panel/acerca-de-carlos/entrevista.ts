import { field, GHOST, HINT, iconSvg, value } from "../ui";
import { bindListActions, MAX_ITEMS, moveButtons, type Editor, type SectionEditor } from "./comun";

export const interview: SectionEditor = {
  html(editor: Editor) {
    const list = editor.page.entrevista;
    const rows = list.map((e, i) => `
      <fieldset class="flex min-w-0 flex-col gap-4 rounded-[3px] border border-base-300 p-4">
        <legend class="px-1 text-sm font-bold">Pregunta ${i + 1}</legend>
        ${field({ id: `pregunta-${i}`, label: "Pregunta", value: e.pregunta, max: 160 })}
        ${field({ id: `respuesta-${i}`, label: "Respuesta", value: e.respuesta, max: 1000, area: true, hint: "Hasta 1000 caracteres." })}
        <div class="flex flex-wrap gap-1">${moveButtons("pregunta", i, list.length, `pregunta ${i + 1}`)}</div>
      </fieldset>`).join("");
    return `<div class="flex max-w-[760px] flex-col gap-5">${rows || '<p class="m-0 text-[0.9rem]">Aún no hay preguntas.</p>'}
      ${list.length < MAX_ITEMS ? `<button type="button" data-question-add class="${GHOST} self-start">${iconSvg("plus", 17)} Añadir pregunta</button>` : ""}
      <p class="${HINT}">Hasta ${MAX_ITEMS} preguntas. No repitas lo que ya dicen las tarjetas o la biografía.</p></div>`;
  },
  capture(form: HTMLElement, editor: Editor) {
    editor.page.entrevista.forEach((e, i) => {
      if (!form.querySelector(`#pregunta-${i}`)) return;
      e.pregunta = value(form, `#pregunta-${i}`);
      e.respuesta = value(form, `#respuesta-${i}`);
    });
  },
  bind(form: HTMLElement, editor: Editor) {
    const capture = () => interview.capture(form, editor);
    form.querySelector("[data-question-add]")?.addEventListener("click", () => {
      capture();
      editor.page.entrevista.push({ pregunta: "", respuesta: "" });
      editor.rerender();
      form.ownerDocument.querySelector<HTMLInputElement>(`#pregunta-${editor.page.entrevista.length - 1}`)?.focus();
    });
    bindListActions(form, editor, capture);
  },
};
