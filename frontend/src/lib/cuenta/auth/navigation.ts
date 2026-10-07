const SESION = "astudillo:sesion";

/** Lo recuerda en el navegador: Layout.astro lo aplica antes de pintar la página siguiente. */
export function setAccountNav(authenticated: boolean) {
  document.documentElement.toggleAttribute("data-sesion", authenticated);
  try {
    localStorage.setItem(SESION, authenticated ? "1" : "0");
  } catch { /* sin almacenamiento solo se pierde el aviso anticipado */ }
}
