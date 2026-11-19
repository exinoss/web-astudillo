export const VERSION_LEGAL = '2026-11-18.1';
export const TEXTO_ACEPTACION = 'Tengo 16 años o más, acepto los Términos y condiciones y autorizo el uso de mis datos para gestionar mi cuenta, alertas, sugerencias y consultas, y la publicación de mis sugerencias y de las alertas que se aprueben.';

export interface AceptacionLegal {
  version: string;
  aceptada: true;
}
