import { Elysia, t } from 'elysia';
import { normalizeEmail } from '../../security';
import { PERMISSIONS } from '../permissions';
import { access } from '../../http';
import { clearSession, email, googleCredential, ipOf, password, redirectToAccount, strict, token, type AuthContext } from './common';
import { LARGOS } from '../../contracts/limites';

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
        access(cookie), PERMISSIONS.passwordAdd,
      );
      await passwords.addToGoogle(user.id_usuario, user.correo, body.credential, body.contrasenia);
      return { ok: true };
    }, { body: t.Object({ credential: googleCredential, contrasenia: password }, strict) })
    .post('/password/change', async ({ body, cookie, request, server }) => {
      const user = await authorization.require(
        access(cookie), PERMISSIONS.passwordChange,
      );
      // Una contraseña actual incorrecta suma fallos con sanción progresiva (createAttempts).
      await passwords.change(user.id_usuario, body.contraseniaActual,
        body.contraseniaNueva, body.confirmarContrasenia, ipOf(server, request, config.trustProxyIp));
      clearSession(context, cookie);
      return { message: 'Contraseña actualizada. Inicia sesión de nuevo' };
    }, { body: t.Object({
      contraseniaActual: t.String({ minLength: 1, maxLength: LARGOS.cuenta.contrasenia }),
      contraseniaNueva: password, confirmarContrasenia: password,
    }, strict) });
}
