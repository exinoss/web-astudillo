// Se guardan como textos con clave `enlace.*`. Sin dependencias: también lo usa el panel en el navegador.
import { comunidadWhatsapp, REDES_SOCIALES } from "../../../../../backend/src/contracts/redes";

export { comunidadWhatsapp, enlaceRed as enlaceRedValido, MAX_ENLACE_RED, normalizarWhatsapp, REDES_SOCIALES, type RedSocial, usuarioRed, valorWhatsapp, whatsappValido } from "../../../../../backend/src/contracts/redes";

export const REDES = {
  ...REDES_SOCIALES,
  whatsapp: { clave: "enlace.whatsapp", nombre: "WhatsApp" },
} as const;

export type Red = keyof typeof REDES;

/** WhatsApp se guarda como número sin «+» (593…, el formato de wa.me) o como enlace de comunidad, que se usa tal cual. */
export const whatsappUrl = (valor: string) => valor.startsWith("https://") ? valor : `https://wa.me/${valor}`;

/** Nombre accesible de un enlace de WhatsApp ya armado con `whatsappUrl()`. */
export const whatsappEtiqueta = (url: string) => comunidadWhatsapp(url)
  ? "Unirse a la comunidad de WhatsApp de Carlos Astudillo (abre en otra pestaña)"
  : "Escribir por WhatsApp a Carlos Astudillo (abre en otra pestaña)";
