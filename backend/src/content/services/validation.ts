import { enlaceRed, esRutaDelSitio, REDES_SOCIALES, type RedSocial, valorWhatsapp } from '../../contracts/redes';
import { ApiError } from '../../http';
import { ANIO_BIOGRAFIA } from '../../contracts/limites';

/** Valida un `enlace.*`: redes solo por https a su dominio y WhatsApp como número 593… o enlace de comunidad. */
export function linkValue(key: string, value: string) {
  const text = value.trim();
  if (key === 'enlace.whatsapp') {
    const whatsapp = valorWhatsapp(text);
    if (!whatsapp) throw new ApiError(422, 'WhatsApp: escribe el número (0985658595 o +593985658595) o el enlace de la comunidad (https://chat.whatsapp.com/…)');
    return whatsapp;
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
  if (!esRutaDelSitio(path) || path.length > 200)
    throw new ApiError(422, `${field}: escribe una página del sitio, por ejemplo /propuestas/agua-potable/`);
  return path;
}

/** Año de un hito de la biografía: cuatro cifras, entre 1900 y el año que viene. */
export function year(value: string, field: string) {
  const text = value.trim();
  const number = Number(text);
  if (!ANIO_BIOGRAFIA.test(text) || number < 1900 || number > new Date().getFullYear() + 1)
    throw new ApiError(422, `${field}: elige un año de cuatro cifras`);
  return text;
}
