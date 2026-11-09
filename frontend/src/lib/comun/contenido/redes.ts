// Se guardan como textos con clave `enlace.*`. Sin dependencias: también lo usa el panel en el navegador.
import { REDES_SOCIALES } from "../../../../../backend/src/contracts/redes";

export { enlaceRed as enlaceRedValido, MAX_ENLACE_RED, normalizarWhatsapp, REDES_SOCIALES, type RedSocial, usuarioRed, whatsappValido } from "../../../../../backend/src/contracts/redes";

export const REDES = {
  ...REDES_SOCIALES,
  whatsapp: { clave: "enlace.whatsapp", nombre: "WhatsApp" },
} as const;

export type Red = keyof typeof REDES;

/** WhatsApp se guarda como número internacional sin «+» (593…); wa.me lo espera así. */
export const whatsappUrl = (numero: string) => `https://wa.me/${numero}`;
