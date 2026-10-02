import { ApiError } from '../data/http/api-client';
import { errorText, showStatus, waitText } from './page';

const DAY = 86_400;
const LOCK = `<svg class="candado" viewBox="0 0 24 24" aria-hidden="true">
  <path class="arco" d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  <g class="cuerpo"><rect x="4.5" y="11" width="15" height="10" rx="2" fill="currentColor"/><circle class="ojo" cx="12" cy="16" r="1.6"/></g>
</svg>`;

/** Texto corto del botón: «0:59» bajo una hora, «5 h 59 min» bajo un día y «2 d 23 h» después. */
export function countdownLabel(seconds: number) {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  if (seconds < DAY) return `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')} min`;
  return `${Math.floor(seconds / DAY)} d ${Math.floor((seconds % DAY) / 3600)} h`;
}

export const isLocked = (button: HTMLButtonElement) => button.dataset.bloqueo !== undefined;

/** Reactiva el botón al terminar un envío, salvo que el límite de intentos lo haya bloqueado. */
export const releaseButton = (button: HTMLButtonElement) => { button.disabled = isLocked(button); };

/** Pone el botón en gris con el candado y la cuenta atrás; al llegar a cero lo devuelve como estaba. */
function lockButton(button: HTMLButtonElement, seconds: number, onEnd: () => void) {
  const original = button.innerHTML;
  const until = Date.now() + seconds * 1000;
  button.dataset.bloqueo = '';
  button.disabled = true;
  button.innerHTML = `${LOCK}<span></span>`;
  const label = button.querySelector<HTMLElement>('span')!;
  const tick = () => {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    label.textContent = `Espera ${countdownLabel(left)}`;
    if (left) return;
    clearInterval(timer);
    button.innerHTML = original;
    delete button.dataset.bloqueo;
    button.disabled = false;
    onEnd();
  };
  const timer = window.setInterval(tick, 1000);
  tick();
}

function recoveryLink(text: string, correo: string, alone: boolean) {
  const link = document.createElement('a');
  link.href = `/cuenta/recuperar/${correo ? `?correo=${encodeURIComponent(correo)}` : ''}`;
  link.textContent = text;
  link.className = `font-bold underline${alone ? ' inline-flex min-h-11 items-center' : ''}`;
  return link;
}

/**
 * Muestra el error de un formulario de cuenta. Si es el límite de intentos, bloquea el botón con la
 * cuenta atrás y, en el acceso (`correo`), ofrece restablecer la contraseña en el primer bloqueo o
 * en uno de días.
 */
export function showFormError(status: HTMLElement, error: unknown, button: HTMLButtonElement, correo?: string) {
  if (!(error instanceof ApiError) || error.status !== 429 || !error.retryAfter) {
    showStatus(status, errorText(error), true);
    return;
  }
  showStatus(status, `Demasiados intentos. Podrás intentarlo de nuevo en ${waitText(error.retryAfter)}.`, true);
  if (correo !== undefined && error.suggestRecovery) {
    status.append(document.createElement('br'), recoveryLink('¿Olvidaste tu contraseña? Restablécela ahora', correo, true));
  } else if (correo !== undefined && error.retryAfter >= DAY) {
    status.append(' Si es tu cuenta, puedes ', recoveryLink('restablecer la contraseña', correo, false), ' y entrar ya.');
  }
  lockButton(button, error.retryAfter, () => { status.hidden = true; });
}
