import { statsRepository } from "../data/stats";
import { inDraftPreview } from "./vista-previa";
import { guardarClave, leerClave } from "./almacen";

const SESION = "visita-registrada";

/** Una vez por sesión del navegador; ni la vista previa ni los navegadores automatizados cuentan. */
export function registrarVisita() {
  if (inDraftPreview() || navigator.webdriver) return;
  // Sin almacenamiento de sesión se cuenta igual: el backend evita repetirla.
  if (leerClave("sesion", SESION)) return;
  guardarClave("sesion", SESION, "1");
  void statsRepository.visit();
}
