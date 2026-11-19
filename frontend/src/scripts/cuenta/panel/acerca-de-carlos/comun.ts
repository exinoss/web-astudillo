import { type AboutCarlosSlug, type DraftAboutCarlosPage, type Photo } from "../../../../lib/data/http/admin-api";
import { enlazarLista, notify, subirFotos } from "../ui";

export type Section = "video" | "entrevista" | "galeria";

export interface Editor { slug: AboutCarlosSlug; page: DraftAboutCarlosPage; rerender(): void }

export interface SectionEditor {
  html(editor: Editor): string;
  capture(form: HTMLElement, editor: Editor): void;
  bind(form: HTMLElement, editor: Editor): void;
}

export const MAX_ITEMS = 6;

export function onFiles(input: HTMLInputElement | null, limit: number, use: (foto: Photo) => void, editor: Editor, capture: () => void) {
  input?.addEventListener("change", () => {
    const files = [...(input.files ?? [])].slice(0, limit);
    if (!files.length) return;
    capture();
    const page = editor.page;
    void subirFotos(input, files, (foto) => {
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
  const lists = { video: editor.page.videos, pregunta: editor.page.entrevista, foto: editor.page.galeria } as Record<string, unknown[]>;
  enlazarLista(form, (tipo) => lists[tipo], (mutar, movido) => {
    capture();
    mutar();
    if (movido) onMove?.(movido.indice);
    editor.rerender();
  });
}
