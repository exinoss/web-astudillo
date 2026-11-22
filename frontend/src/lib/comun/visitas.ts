import { statsRepository } from "../data/stats";
import { inDraftPreview } from "./vista-previa";
import { guardarClave, leerClave } from "./almacen";
import { VISITANTE } from "../../../../backend/src/contracts/visitas";

const CLAVE = "visitante";

/** Identificador anónimo del navegador, compartido por sus pestañas; null si el navegador no deja guardarlo. */
function visitante() {
  const guardado = leerClave("local", CLAVE);
  if (guardado && VISITANTE.test(guardado)) return guardado;
  const nuevo = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return guardarClave("local", CLAVE, nuevo) ? nuevo : null;
}

/** Avisa de la actividad en cada página cargada; el backend decide si es una visita nueva. */
export function registrarVisita() {
  if (inDraftPreview() || navigator.webdriver || location.pathname.startsWith("/cuenta/panel")) return;
  const id = visitante();
  if (id) void statsRepository.visit(id);
}
