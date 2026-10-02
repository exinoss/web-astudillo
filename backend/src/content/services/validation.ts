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

const NETWORKS: Record<string, { name: string; hosts: string[] }> = {
  'enlace.facebook': { name: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'] },
  'enlace.tiktok': { name: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'] },
};

/**
 * Valida el valor de una clave `enlace.*`. Facebook y TikTok: solo https a su dominio.
 * WhatsApp: un número como se marca (0985658595, +593 98 565 8595); se guarda en formato
 * internacional sin «+» (593985658595), que es lo que espera wa.me.
 */
export function linkValue(key: string, value: string) {
  const text = value.trim();
  if (key === 'enlace.whatsapp') {
    const digits = text.replace(/[\s().-]/g, '').replace(/^\+/, '').replace(/^0(?=\d{9}$)/, '593');
    if (!/^\d{10,15}$/.test(digits)) throw new ApiError(422, 'WhatsApp: escribe el número, por ejemplo 0985658595 o +593985658595');
    return digits;
  }
  const network = NETWORKS[key];
  if (!network) throw new ApiError(422, 'Clave de texto no válida');
  let url: URL;
  try { url = new URL(text); } catch { throw new ApiError(422, `${network.name}: escribe el enlace completo, empezando por https://`); }
  if (url.protocol !== 'https:' || !network.hosts.includes(url.hostname) || url.username || url.password || text.length > 300)
    throw new ApiError(422, `${network.name}: el enlace debe ser de ${network.hosts[0]} y empezar por https://`);
  return url.href;
}

/** Ruta interna del sitio para los enlaces del chat (`/ciudadania/chat/`, `/#contacto`). */
export function sitePath(value: string, field: string) {
  const path = value.trim();
  if (!/^\/[a-z0-9/#-]*$/.test(path) || path.length > 200 || path.startsWith('//'))
    throw new ApiError(422, `${field}: escribe una página del sitio, por ejemplo /propuestas/agua-potable/`);
  return path;
}

/** Año de un hito de la biografía: cuatro cifras, entre 1900 y el año que viene. */
export function year(value: string, field: string) {
  const text = value.trim();
  const number = Number(text);
  if (!/^\d{4}$/.test(text) || number < 1900 || number > new Date().getFullYear() + 1)
    throw new ApiError(422, `${field}: elige un año de cuatro cifras`);
  return text;
}
