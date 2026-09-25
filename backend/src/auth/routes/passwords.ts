import { Elysia, t } from 'elysia';
import { normalizeEmail } from '../../security';
import { PERMISSIONS } from '../permissions';
import { clearSession, email, ipOf, password, redirectToAccount, strict, token, type AuthContext } from './common';

/** Expone recuperación, cambio y alta de contraseña con validación de permisos. */
export function passwordRoutes(context: AuthContext) {
  const { passwords, limit, authorization, config } = context;
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/password/reset-request', async ({ body, request, server }) => {
      const correo = normalizeEmail(body.correo), ip = ipOf(server, request, config.trustProxyIp);
      limit(`reset:email:${correo}`, 3, 60 * 60_000);
      limit(`reset:ip:${ip}`, 20, 60 * 60_000);
      await passwords.requestReset(body.correo);
      return { message: 'Si existe una cuenta con contraseña, recibirás instrucciones' };
    }, { body: t.Object({ correo: email }, strict) })
    .get('/password/reset', ({ query }) =>
      redirectToAccount(context.config.origin, '/cuenta/restablecer/', query.token),
      { query: t.Object({ token }) })
    .post('/password/reset', async ({ body, cookie }) => {
      await passwords.reset(body.token, body.contrasenia);
      clearSession(context, cookie);
      return { message: 'Contraseña actualizada. Inicia sesión de nuevo' };
    }, { body: t.Object({ token, contrasenia: password }, strict) })
    .post('/password', async ({ body, cookie }) => {
      const user = await authorization.require(
        cookie.access.value as string | undefined, PERMISSIONS.passwordAdd,
      );
      await passwords.addToGoogle(user.id_usuario, body.credential, body.contrasenia);
      return { ok: true };
    }, { body: t.Object({ credential: t.String({ minLength: 100 }), contrasenia: password }, strict) })
    .post('/password/change', async ({ body, cookie, request, server }) => {
      const user = await authorization.require(
        cookie.access.value as string | undefined, PERMISSIONS.passwordChange,
      );
      limit(`change:user:${user.id_usuario}`, 5, 15 * 60_000);
      limit(`change:ip:${ipOf(server, request, config.trustProxyIp)}`, 20, 15 * 60_000);
      await passwords.change(user.id_usuario, body.contraseniaActual,
        body.contraseniaNueva, body.confirmarContrasenia);
      clearSession(context, cookie);
      return { message: 'Contraseña actualizada. Inicia sesión de nuevo' };
    }, { body: t.Object({
      contraseniaActual: t.String({ minLength: 1, maxLength: 128 }),
      contraseniaNueva: password, confirmarContrasenia: password,
    }, strict) });
}
