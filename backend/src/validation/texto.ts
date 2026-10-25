import { ApiError } from '../http';

// Rechaza marcado aunque el sitio escape al renderizar: el contenido es texto plano por contrato.
const MARKUP = /<\s*[a-z!/?]/i;
// Invisibles que trae el texto copiado de redes o de WhatsApp (que rodea los teléfonos de marcas de dirección):
// se quitan sin avisar. La unión de emojis compuestos (U+200D) se conserva.
const INVISIBLE = new RegExp('[\\u200b\\u200e\\u200f\\u202a-\\u202c\\u2066-\\u2069\\ufeff]', 'g');
// Controles sin sentido en un texto (el salto de línea y el tabulador se normalizan antes) y los forzados de
// dirección, que muestran las letras al revés y sirven para disfrazar un nombre.
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b-\\u001f\\u007f\\u202d\\u202e]');

/** Normaliza y valida un texto plano; lanza 422 con el nombre del campo si no es válido. */
export function plainText(value: string, field: string, max: number, options: { multiline?: boolean } = {}) {
  const text = value.replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, ' ').replace(INVISIBLE, '').trim();
  if (!text) throw new ApiError(422, `${field}: no puede quedar vacío`);
  if (Array.from(text).length > max) throw new ApiError(422, `${field}: máximo ${max} caracteres`);
  if (MARKUP.test(text)) throw new ApiError(422, `${field}: escribe solo texto, sin etiquetas`);
  if (CONTROL.test(text)) throw new ApiError(422, `${field}: contiene caracteres no permitidos`);
  if (!options.multiline && text.includes('\n')) throw new ApiError(422, `${field}: escribe el texto en una sola línea`);
  return text;
}
