import { statsRepository } from "../data/stats";
import { inDraftPreview } from "./vista-previa";

const SESION = "visita-registrada";

/** Una vez por sesión del navegador; ni la vista previa ni los navegadores automatizados cuentan. */
export function registrarVisita() {
  if (inDraftPreview() || navigator.webdriver) return;
  try {
    if (sessionStorage.getItem(SESION)) return;
    sessionStorage.setItem(SESION, "1");
  } catch { /* sin almacenamiento de sesión se cuenta igual; el backend evita repetirla */ }
  void statsRepository.visit();
}
