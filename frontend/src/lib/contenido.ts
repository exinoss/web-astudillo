import { contentRepository } from "./data";
import { REDES, type Red, whatsappUrl } from "./contenido/redes";
import { TEXTOS, type TextKey } from "./contenido/textos";

export { TEXTOS, type TextKey };

/** Valor vigente de un texto: el publicado desde el panel o, si no hay, el del diseño. */
export async function texto(clave: TextKey) {
  return (await contentRepository.getTexts())[clave] ?? TEXTOS[clave].texto;
}

export async function enlaceRed(red: Red) {
  const valor = (await contentRepository.getTexts())[REDES[red].clave] ?? REDES[red].porDefecto;
  return red === "whatsapp" ? whatsappUrl(valor) : valor;
}
