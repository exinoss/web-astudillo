import { contentRepository } from "./data";
import { TEXTOS, type TextKey } from "./contenido/textos";

export { TEXTOS, type TextKey };

let overrides: Promise<Record<string, string>> | undefined;

/** Valor vigente de un texto: el publicado desde el panel o, si no hay, el del diseño. */
export async function texto(clave: TextKey) {
  overrides ??= contentRepository.getTexts();
  return (await overrides)[clave] ?? TEXTOS[clave].texto;
}
