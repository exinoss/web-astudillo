/** Actualiza la etiqueta del enlace de cuenta según el estado autenticado. */
export function setAccountNav(authenticated: boolean) {
  const label = document.querySelector<HTMLElement>('.account-link .account-label');
  if (label) label.textContent = authenticated ? 'Mi cuenta' : 'Iniciar sesión';
}
