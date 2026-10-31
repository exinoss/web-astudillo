import "../campos";
import { bloquearMientras } from "../../../lib/cuenta/panel/cambios";
import { adminApi } from "../../../lib/data/http/admin-api";
import { ApiError } from "../../../lib/data/http/api-client";
import { DANGER, esc, GHOST, HINT, INPUT, LABEL, state } from "./ui";

const ESPERA_REENVIO = 60;

interface Confirmacion {
  /** HTML ya escapado: qué va a pasar si se confirma. */
  resumen: string;
  boton: string;
  peligro?: boolean;
  enviar: (confirmacion: string) => Promise<unknown>;
}

/**
 * Pide la contraseña (o un código enviado al correo, si la cuenta no tiene contraseña) y ejecuta `enviar`.
 * Resuelve true si se hizo y false si se canceló; un 409 (otra persona cambió la cuenta) cierra el modal y se relanza.
 */
export function confirmarIdentidad(o: Confirmacion): Promise<boolean> {
  const conContrasenia = state.profile!.tieneContrasenia;
  const dialogo = document.createElement("dialog");
  dialogo.setAttribute("aria-labelledby", "confirmar-titulo");
  dialogo.dataset.confirmacion = "";
  dialogo.className =
    "m-auto w-[min(460px,calc(100%-32px))] rounded-[3px] border-t-[5px] border-t-accent bg-base-100 p-0 text-primary [box-shadow:0_20px_60px_#06317640] backdrop:bg-primary/55";
  const campo = conContrasenia
    ? `<label for="confirmar-valor" class="${LABEL}">Tu contraseña</label>
      <div class="relative">
        <input id="confirmar-valor" type="password" autocomplete="current-password" maxlength="128" required aria-describedby="confirmar-error" class="${INPUT} pr-[90px]" />
        <button type="button" class="password-toggle absolute inset-y-0 right-0 min-h-11 min-w-[76px] px-3 text-[0.82rem] font-bold" data-target="confirmar-valor" aria-label="Mostrar tu contraseña" aria-pressed="false">Mostrar</button>
      </div>`
    : `<p class="m-0 mb-3 text-[0.88rem]" data-aviso-codigo>Te enviaremos un código a <strong class="[overflow-wrap:anywhere]">${esc(state.profile!.correo)}</strong>.</p>
      <button type="button" class="${GHOST} w-full disabled:cursor-not-allowed disabled:opacity-60" data-enviar-codigo>Enviar código</button>
      <div data-con-codigo hidden>
        <label for="confirmar-valor" class="${LABEL} mt-4">Código</label>
        <input id="confirmar-valor" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required aria-describedby="confirmar-error confirmar-pista" class="${INPUT} tracking-[0.3em]" />
        <p id="confirmar-pista" class="${HINT}">Vence en 10 minutos.</p>
      </div>`;
  dialogo.innerHTML = `
    <form id="confirmar-form" class="flex flex-col px-7 py-6 max-tablet:px-5 max-tablet:py-5" novalidate>
      <h2 id="confirmar-titulo" class="m-0 mb-2 text-[1.8rem] leading-[1.05]">Confirma que eres tú</h2>
      <p class="m-0 mb-5 text-[0.9rem] leading-normal">${o.resumen}</p>
      ${campo}
      <p id="confirmar-error" class="m-0 mt-2 text-[0.8rem] font-bold text-error" role="alert" hidden></p>
      <div class="mt-6 flex justify-end gap-2.5 max-tablet:flex-col-reverse">
        <button type="button" class="${GHOST}" data-cancelar>Cancelar</button>
        <button type="submit" class="${o.peligro ? DANGER : "button"}" ${conContrasenia ? "" : "disabled"}>${esc(o.boton)}</button>
      </div>
    </form>`;
  document.body.append(dialogo);
  const form = dialogo.querySelector<HTMLFormElement>("form")!;
  const valor = dialogo.querySelector<HTMLInputElement>("#confirmar-valor")!;
  const error = dialogo.querySelector<HTMLElement>("#confirmar-error")!;
  const confirmar = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const avisar = (mensaje: string | null) => {
    error.textContent = mensaje ?? "";
    error.hidden = !mensaje;
    valor.toggleAttribute("aria-invalid", !!mensaje);
  };

  return new Promise<boolean>((resolver, rechazar) => {
    let hecho = false;
    dialogo.addEventListener("close", () => { dialogo.remove(); resolver(hecho); });
    dialogo.querySelector("[data-cancelar]")!.addEventListener("click", () => dialogo.close());
    valor.addEventListener("input", () => avisar(null));

    const enviarCodigo = dialogo.querySelector<HTMLButtonElement>("[data-enviar-codigo]");
    enviarCodigo?.addEventListener("click", () => void bloquearMientras(enviarCodigo, async () => {
      try {
        await adminApi.sendConfirmationCode();
      } catch (e) {
        return avisar(e instanceof Error ? e.message : "No se pudo enviar el código.");
      }
      dialogo.querySelector("[data-aviso-codigo]")!.firstChild!.textContent = "Te enviamos un código a ";
      dialogo.querySelector<HTMLElement>("[data-con-codigo]")!.hidden = false;
      confirmar.disabled = false;
      valor.focus();
      for (let falta = ESPERA_REENVIO; falta > 0; falta--) {
        enviarCodigo.textContent = `Reenviar código en ${falta} s`;
        await new Promise((r) => setTimeout(r, 1000));
      }
      enviarCodigo.textContent = "Reenviar código";
    }));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!valor.value.trim()) {
        avisar(conContrasenia ? "Escribe tu contraseña." : "Escribe el código.");
        return valor.focus();
      }
      void bloquearMientras(confirmar, async () => {
        try {
          await o.enviar(valor.value);
          hecho = true;
          dialogo.close();
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            dialogo.close();
            return rechazar(e);
          }
          avisar(e instanceof Error ? e.message : "No se pudo completar la acción.");
          valor.select();
        }
      });
    });
    dialogo.showModal();
    (enviarCodigo ?? valor).focus();
  });
}
