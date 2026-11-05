import { adminApi, type AboutCarlosSlug, type DraftAboutCarlosPage, type Photo } from "../../../../lib/data/http/admin-api";
import { notify, subirFotos } from "../ui";

export type Section = "tarjetas" | "video" | "retrato" | "entrevista" | "galeria";

export interface Editor { slug: AboutCarlosSlug; page: DraftAboutCarlosPage; rerender(): void }

export interface SectionEditor {
  html(editor: Editor): string;
  capture(form: HTMLElement, editor: Editor): void;
  bind(form: HTMLElement, editor: Editor): void;
}

export const MAX_ITEMS = 6;
const RADIO = "flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border border-base-300 px-3 text-[0.82rem] font-bold has-checked:border-primary has-checked:bg-primary-soft focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-neutral";

export const radios = (name: string, options: [string, string, string][], checked: string) => options.map(([val, label, mark]) => `
  <label class="${RADIO}"><input type="radio" name="${name}" value="${val}" ${val === checked ? "checked" : ""} class="sr-only" />${mark}${label}</label>`).join("");

export function onFiles(input: HTMLInputElement | null, limit: number, use: (foto: Photo) => void, editor: Editor, capture: () => void) {
  input?.addEventListener("change", () => {
    const files = [...(input.files ?? [])].slice(0, limit);
    if (!files.length) return;
    capture();
    const page = editor.page;
    void subirFotos(files, (foto) => {
      // Si mientras subía se cambió de página, la foto no se añade a la otra.
      if (editor.page !== page) {
        notify("Cambiaste de página mientras se subía la foto; vuelve a subirla.", true);
        return false;
      }
      use(foto);
    }).then((todas) => {
      if (!todas) return;
      notify("Foto subida. Completa los datos y guarda el borrador.");
      editor.rerender();
    });
  });
}

/** `onMove` recibe la nueva posición del elemento movido. */
export function bindListActions(form: HTMLElement, editor: Editor, capture: () => void, onMove?: (index: number) => void) {
  const lists = { tarjeta: editor.page.tarjetas, pregunta: editor.page.entrevista, foto: editor.page.galeria } as Record<string, unknown[]>;
  form.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => {
    capture();
    const list = lists[b.dataset.move!], i = Number(b.dataset.index), j = i + Number(b.dataset.step);
    [list[i], list[j]] = [list[j], list[i]];
    onMove?.(j);
    editor.rerender();
  }));
  form.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => {
    capture();
    lists[b.dataset.remove!].splice(Number(b.dataset.index), 1);
    editor.rerender();
  }));
}
