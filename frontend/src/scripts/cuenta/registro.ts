import { authRepository } from '../../lib/data/auth';
import { releaseButton, showFormError } from '../../lib/cuenta/auth/bloqueo';
import { showStatus, validateFields, value } from '../../lib/cuenta/auth/page';
import { mostrarCarga } from '../../lib/comun/animaciones';
import { acceptanceOf } from '../../lib/cuenta/auth/acceptance';

const form = document.querySelector<HTMLFormElement>('#register-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;
let registering = false;

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (registering) return;
  registering = true;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  const terminarCarga = mostrarCarga(form);
  try {
    if (!validateFields(form)) {
      showStatus(status, 'Revisa los campos marcados antes de continuar.', true);
      return;
    }
    const contrasenia = value(form, 'contrasenia');
    const confirmarContrasenia = value(form, 'confirmarContrasenia');
    await authRepository.register({
      nombresCompletos: value(form, 'nombresCompletos'),
      direccion: value(form, 'direccion'),
      correo: value(form, 'correo'),
      contrasenia, confirmarContrasenia,
      aceptacion: acceptanceOf(form)!,
    });
    form.hidden = true;
    showStatus(status, 'Si el correo puede registrarse, recibirás un enlace para confirmarlo. Revisa también la carpeta de spam.');
  } catch (error) {
    showFormError(status, error, submit);
  } finally {
    terminarCarga();
    registering = false;
    releaseButton(submit);
  }
});
