/** Escapa texto para insertarlo en HTML generado desde scripts; todo dato de la API pasa por aquí. */
export function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Como `esc`, conservando los saltos de línea del texto como `<br>`. */
export const escLines = (value: string) => value.split("\n").map(esc).join("<br>");
