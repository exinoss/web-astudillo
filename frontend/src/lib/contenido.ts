import { contentRepository } from "./data";
import { TEXTOS, type TextKey } from "./contenido/textos";

export { TEXTOS, type TextKey };

/** Valor vigente de un texto: el publicado desde el panel o, si no hay, el del diseño. */
export async function texto(clave: TextKey) {
  return (await contentRepository.getTexts())[clave] ?? TEXTOS[clave].texto;
}
