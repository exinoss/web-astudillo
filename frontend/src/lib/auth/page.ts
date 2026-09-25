import { ApiError } from '../data/http/api-client';
import { requirePassword } from './password';

/** Muestra un estado anunciado correctamente por tecnologías de asistencia. */
export function showStatus(element: HTMLElement, message: string, error = false) {
  element.textContent = message;
  element.dataset.error = String(error);
  element.setAttribute('role', error ? 'alert' : 'status');
  element.setAttribute('aria-live', error ? 'assertive' : 'polite');
  element.hidden = false;
}

/** Limpia los errores accesibles añadidos a los campos del formulario. */
export function clearFieldErrors(form: HTMLFormElement) {
  form.querySelectorAll<HTMLInputElement>('input[aria-invalid="true"]').forEach(input => {
    input.removeAttribute('aria-invalid');
    const error = document.getElementById(`${input.id}-error`);
    if (error) { error.textContent = ''; error.hidden = true; }
  });
}

/** Asocia un mensaje de error al campo y opcionalmente le devuelve el foco. */
export function fieldError(form: HTMLFormElement, name: string, message: string, focus = true) {
  const input = form.elements.namedItem(name);
  if (!(input instanceof HTMLInputElement)) return;
  input.setAttribute('aria-invalid', 'true');
  const error = document.getElementById(`${input.id}-error`);
  if (error) { error.textContent = message; error.hidden = false; }
  if (focus) input.focus();
}

/** Valida campos HTML y la política de contraseña antes de enviar el formulario. */
export function validateFields(form: HTMLFormElement) {
  clearFieldErrors(form);
  const mark = (name: string, message: string) => {
    fieldError(form, name, message, false);
  };
  for (const input of form.querySelectorAll<HTMLInputElement>('input')) {
    let message = '';
    if (input.required && !input.value.trim()) message = 'Completa este campo.';
    else if (input.type === 'email' && input.value &&
      (!input.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)))
      message = 'Escribe un correo válido, por ejemplo nombre@ejemplo.com.';
    else if (input.maxLength > 0 && input.value.length > input.maxLength)
      message = `Usa como máximo ${input.maxLength} caracteres.`;
    if (message) mark(input.name, message);
  }
  const passwordName = form.dataset.newPassword;
  if (passwordName) {
    const password = value(form, passwordName);
    const confirmation = value(form, 'confirmarContrasenia');
    if (password && confirmation) {
      try { requirePassword(password, confirmation); }
      catch (error) {
        const message = errorText(error);
        mark(message.includes('coinciden') ? 'confirmarContrasenia' : passwordName, message);
      }
    }
  }
  const first = form.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
  first?.focus();
  return !first;
}

/** Convierte errores de API o runtime en un mensaje visible para la persona. */
export function errorText(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message : 'No se pudo completar la solicitud.';
}

/** Lee el token del enlace y lo quita de la barra de direcciones. */
export function readToken() {
  const token = new URLSearchParams(location.search).get('token');
  history.replaceState(null, '', location.pathname + location.hash);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function value(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? '');
}
