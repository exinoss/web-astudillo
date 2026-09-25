import { authRepository } from '../lib/data/auth';
import { errorText, showStatus, validateFields, value } from '../lib/auth/page';

const form = document.querySelector<HTMLFormElement>('#register-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;

// Valida los datos y solicita el enlace de verificación por correo.
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
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
    });
    form.hidden = true;
    showStatus(status, 'Si el correo puede registrarse, recibirás un enlace para confirmarlo. Revisa también la carpeta de spam.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});
