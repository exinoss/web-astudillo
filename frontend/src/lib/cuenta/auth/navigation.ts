import { guardarClave, leerClave } from "../../comun/almacen";

const SESION = "astudillo:sesion";
const AVISO_VISTO = "astudillo:avisos-vistos";

/** Lo recuerda en el navegador: Layout.astro lo aplica antes de pintar la página siguiente. */
export function setAccountNav(authenticated: boolean) {
  document.documentElement.toggleAttribute("data-sesion", authenticated);
  // Sin sesión se olvida la notificación de avisos: vuelve a salir al iniciar sesión.
  if (!authenticated) avisoVisto(false);
  guardarClave("local", SESION, authenticated ? "1" : "0");
}

/** Si en esta sesión ya salió la notificación de avisos; `marcar` la da por vista y `false` la olvida (al cerrar sesión). */
export function avisoVisto(marcar?: boolean) {
  if (marcar !== undefined) guardarClave("sesion", AVISO_VISTO, marcar ? "1" : null);
  return leerClave("sesion", AVISO_VISTO) === "1";
}
