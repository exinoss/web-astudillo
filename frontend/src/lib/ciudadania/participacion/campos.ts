export function marcarError(campo: HTMLElement, mensaje: string | null) {
  if (mensaje) campo.setAttribute('aria-invalid', 'true');
  else campo.removeAttribute('aria-invalid');
  const error = document.getElementById(`${campo.id}-error`);
  if (error) {
    error.textContent = mensaje ?? '';
    error.hidden = !mensaje;
  }
}
