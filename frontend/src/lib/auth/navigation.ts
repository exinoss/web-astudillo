/** Actualiza la etiqueta del enlace de cuenta según el estado autenticado. */
export function setAccountNav(authenticated: boolean) {
  const link = document.querySelector<HTMLAnchorElement>('#main-nav a[href="/cuenta/"]');
  if (link) link.textContent = authenticated ? 'Mi cuenta' : 'Iniciar sesión';
}
