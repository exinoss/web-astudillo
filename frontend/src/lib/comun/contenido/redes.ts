// Se guardan como textos con clave `enlace.*`. Sin dependencias: también lo usa el panel en el navegador.
import { REDES_SOCIALES } from "../../../../../backend/src/contracts/redes";

export { enlaceRed as enlaceRedValido, REDES_SOCIALES, type RedSocial, usuarioRed } from "../../../../../backend/src/contracts/redes";

export const REDES = {
  ...REDES_SOCIALES,
  whatsapp: { clave: "enlace.whatsapp", nombre: "WhatsApp" },
} as const;

export type Red = keyof typeof REDES;

/** WhatsApp se guarda como número internacional sin «+» (593…); wa.me lo espera así. */
export const whatsappUrl = (numero: string) => `https://wa.me/${numero}`;

/** Número de WhatsApp como lo escribe una persona (0985658595, +593 98 565 8595) en formato 593…; igual que el backend. */
export const normalizarWhatsapp = (texto: string) =>
  texto.trim().replace(/[\s().-]/g, "").replace(/^\+/, "").replace(/^0(?=\d{9}$)/, "593");
