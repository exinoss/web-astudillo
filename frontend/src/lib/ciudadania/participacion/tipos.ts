import type { AlertType, ParticipationState } from "../../data/types";

/** Tipos de alerta en el orden de los botones del formulario, con su ícono de `lib/comun/iconos.ts`. */
export const TIPOS_ALERTA: { valor: AlertType; nombre: string; icono: string }[] = [
  { valor: "agua", nombre: "Agua", icono: "water" },
  { valor: "basura", nombre: "Basura", icono: "trash" },
  { valor: "alumbrado", nombre: "Alumbrado", icono: "bulb" },
  { valor: "baches", nombre: "Baches", icono: "road" },
  { valor: "seguridad", nombre: "Seguridad", icono: "shield" },
  { valor: "otro", nombre: "Otro", icono: "dots" },
];

export const ESTADOS: Record<ParticipationState, { nombre: string; clases: string }> = {
  recibida: { nombre: "Recibida", clases: "border border-base-300" },
  en_revision: { nombre: "En revisión", clases: "bg-secondary text-primary" },
  atendida: { nombre: "Atendida", clases: "bg-primary text-primary-content" },
};

export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const MIN_DESCRIPCION = 10;
export const MIN_SUGERENCIA = 15;
