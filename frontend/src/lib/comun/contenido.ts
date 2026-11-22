import { contentRepository } from "../data";
import { REDES, type Red, whatsappUrl } from "./contenido/redes";
import { TEXTOS, type TextKey } from "../../../../backend/src/contracts/textos";

export { TEXTOS, type TextKey };

/** Texto publicado de esa clave; falla si no existe. */
export async function texto(clave: TextKey) {
  const valor = (await contentRepository.getTexts())[clave];
  if (valor === undefined) throw new Error(`Falta el texto publicado ${clave}`);
  return valor;
}

/** Enlace publicado de una red social (el de WhatsApp, ya como enlace). */
export async function enlaceRed(red: Red) {
  const valor = (await contentRepository.getTexts())[REDES[red].clave];
  return red === "whatsapp" ? whatsappUrl(valor) : valor;
}
