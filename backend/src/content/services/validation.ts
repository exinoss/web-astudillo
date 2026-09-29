import { ApiError } from '../../http';

// Rechaza marcado aunque el sitio escape al renderizar: el contenido es texto plano por contrato.
const MARKUP = /<\s*[a-z!/?]/i;
// Controles y caracteres invisibles (ancho cero, cambios de dirección); el salto de línea se trata aparte.
const CONTROL = new RegExp('[\\u0000-\\u0009\\u000b-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e]');

/** Normaliza y valida un texto plano; lanza 422 con el nombre del campo si no es válido. */
export function plainText(value: string, field: string, max: number, options: { multiline?: boolean } = {}) {
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text) throw new ApiError(422, `${field}: no puede quedar vacío`);
  if (Array.from(text).length > max) throw new ApiError(422, `${field}: máximo ${max} caracteres`);
  if (MARKUP.test(text)) throw new ApiError(422, `${field}: escribe solo texto, sin etiquetas`);
  if (CONTROL.test(text) || (!options.multiline && text.includes('\n')))
    throw new ApiError(422, `${field}: contiene caracteres no permitidos`);
  return text;
}
