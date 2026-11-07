const SESION = "astudillo:sesion";
const AVISO_VISTO = "astudillo:avisos-vistos";

/** Lo recuerda en el navegador: Layout.astro lo aplica antes de pintar la página siguiente. */
export function setAccountNav(authenticated: boolean) {
  document.documentElement.toggleAttribute("data-sesion", authenticated);
  // Sin sesión se olvida la notificación de avisos: vuelve a salir al iniciar sesión.
  if (!authenticated) avisoVisto(false);
  try {
    localStorage.setItem(SESION, authenticated ? "1" : "0");
  } catch { /* sin almacenamiento solo se pierde el aviso anticipado */ }
}

/** Si en esta sesión ya salió la notificación de avisos; `marcar` la da por vista y `false` la olvida (al cerrar sesión). */
export function avisoVisto(marcar?: boolean) {
  try {
    if (marcar) sessionStorage.setItem(AVISO_VISTO, "1");
    else if (marcar === false) sessionStorage.removeItem(AVISO_VISTO);
    return sessionStorage.getItem(AVISO_VISTO) === "1";
  } catch { return false; /* sin almacenamiento la notificación puede salir en cada página */ }
}
