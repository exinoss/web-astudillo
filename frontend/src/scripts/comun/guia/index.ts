import { guardarClave } from "../../../lib/comun/almacen";
import { bloquearMientras } from "../../../lib/comun/cambios";
import { mostrarInvitacion, quitarInvitacion } from "./invitacion";
import { empezar, retomar } from "./reproductor";

const abrir = document.querySelector<HTMLButtonElement>("[data-guia-abrir]");

/** Cierra la invitación y abre la guía desde el principio; al cerrarla, el foco vuelve al botón fijo. */
function verGuia(evento: MouseEvent) {
  quitarInvitacion();
  bloquearMientras(evento.currentTarget as HTMLButtonElement, () => empezar(0, abrir));
}

abrir?.addEventListener("click", verGuia);
document.querySelector<HTMLButtonElement>("[data-guia-ver]")?.addEventListener("click", verGuia);
document.querySelector<HTMLButtonElement>("[data-guia-no]")?.addEventListener("click", () => {
  guardarClave("local", "guia-vista", "1");
  quitarInvitacion();
  abrir?.focus();
});
if (!retomar()) mostrarInvitacion();
