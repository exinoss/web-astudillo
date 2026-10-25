import { enlaceRed, REDES_SOCIALES, type RedSocial } from '../../contracts/redes';
import { ApiError } from '../../http';

/**
 * Valida el valor de una clave `enlace.*`. Redes: solo https a su dominio (contracts/redes.ts).
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
  const red = (Object.keys(REDES_SOCIALES) as RedSocial[]).find((r) => REDES_SOCIALES[r].clave === key);
  if (!red) throw new ApiError(422, 'Clave de texto no válida');
  const { nombre, hosts } = REDES_SOCIALES[red];
  const url = enlaceRed(red, text);
  if (!url) throw new ApiError(422, `${nombre}: el enlace debe ser de ${hosts[0]} y empezar por https://`);
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
