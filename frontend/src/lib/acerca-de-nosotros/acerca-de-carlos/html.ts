import { escLines } from "../../comun/html";

// data-editable lo usa el modo edición del sitio para encontrar el texto, igual que Editable.astro.
export const editable = (tag: string, key: string, texts: Record<string, string>, className: string) =>
  `<${tag} class="${className}" data-editable="${key}">${escLines(texts[key] ?? "")}</${tag}>`;
