import { esc } from "../../comun/html";
import type { ImageView } from "./vista";

export const img = (image: ImageView, alt: string, className: string, sizes: string, loading: "lazy" | "eager" = "lazy") =>
  `<img class="${className}" src="${esc(image.src)}"${image.srcset ? ` srcset="${esc(image.srcset)}" sizes="${sizes}"` : ""}${image.width ? ` width="${image.width}" height="${image.height}"` : ""} alt="${esc(alt)}" loading="${loading}" decoding="async" />`;

// data-editable lo usa el modo edición del sitio para encontrar el texto, igual que Editable.astro.
export const editable = (tag: string, key: string, texts: Record<string, string>, className: string) =>
  `<${tag} class="${className}" data-editable="${key}">${(texts[key] ?? "").split("\n").map(esc).join("<br>")}</${tag}>`;
