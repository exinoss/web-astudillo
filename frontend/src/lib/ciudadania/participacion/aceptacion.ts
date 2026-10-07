import { acceptanceOf } from '../../cuenta/auth/acceptance';
import { authRepository } from '../../data/auth';
import { marcarError } from './campos';

const controls = new WeakMap<HTMLFormElement, ReturnType<typeof crearControl>>();

function crearControl(form: HTMLFormElement) {
  const block = form.querySelector<HTMLElement>('[data-aceptacion]')!;
  const checkbox = block.querySelector<HTMLInputElement>('input')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = button.querySelector<HTMLElement>('[data-envio-texto]')!;
  const normal = label.textContent!;
  const originallyHidden = label.hidden;
  const composer = form.querySelector<HTMLElement>('[data-chat-controles]');
  let changes = 0;

  function mostrar(pending: boolean) {
    changes++;
    block.hidden = !pending;
    form.dataset.aceptacionPendiente = String(pending);
    button.dataset.aceptacionPendiente = String(pending);
    button.setAttribute('aria-label', pending ? `Aceptar y ${normal.toLowerCase()}` : normal);
    label.textContent = pending ? `Aceptar y ${normal.toLowerCase()}` : normal;
    label.hidden = pending ? false : originallyHidden;
    if (composer) (pending ? form : composer).append(button);
    if (!pending) marcarError(checkbox, null);
  }
  async function actualizar() {
    const revision = changes;
    try {
      const profile = await authRepository.getProfile();
      if (revision === changes) mostrar(profile.terminosAceptados !== true);
    } catch { /* La comprobación del envío presenta los errores de acceso o conexión. */ }
  }
  void actualizar();
  addEventListener('focus', () => void actualizar());
  addEventListener('pageshow', event => { if (event.persisted) void actualizar(); });
  return {
    mostrar,
    async confirmar(accepted: boolean) {
      mostrar(!accepted);
      if (accepted) return true;
      const input = acceptanceOf(form);
      if (!input) {
        marcarError(checkbox, 'Marca la casilla para continuar.');
        checkbox.focus();
        return false;
      }
      await authRepository.acceptTerms(input);
      mostrar(false);
      return true;
    },
    solicitar() {
      checkbox.checked = false;
      mostrar(true);
      checkbox.focus();
    },
  };
}

export function prepararAceptacion(form: HTMLFormElement) {
  let control = controls.get(form);
  if (!control) { control = crearControl(form); controls.set(form, control); }
  return control;
}
