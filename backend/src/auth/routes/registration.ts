import { Elysia, t } from 'elysia';
import { cookieOptions } from '../../http';
import { normalizeEmail } from '../../security';
import { clearCookie, email, ipOf, password, redirectToAccount, strict, token, type AuthContext } from './common';

/** Expone registro y verificación de correo con límites por IP y dirección. */
export function registrationRoutes({ config, registration, limit }: AuthContext) {
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/register', async ({ body, cookie, request, server }) => {
      const correo = normalizeEmail(body.correo), ip = ipOf(server, request, config.trustProxyIp);
      limit(`register:email:${correo}`, 3, 60 * 60_000);
      limit(`register:ip:${ip}`, 20, 60 * 60_000);
      const browser = await registration.request(body);
      if (browser) cookie.registration.set({ value: browser,
        ...cookieOptions(config, 1800, '/api/auth/verify-email') });
      return { message: 'Si el correo puede registrarse, recibirás instrucciones' };
    }, { body: t.Object({
      nombresCompletos: t.String({ minLength: 1, maxLength: 200 }),
      direccion: t.Optional(t.String({ maxLength: 500 })),
      correo: email, contrasenia: password, confirmarContrasenia: password,
    }, strict) })
    .get('/verify-email', ({ query }) => redirectToAccount(config.origin, '/cuenta/verificar/', query.token),
      { query: t.Object({ token }) })
    .post('/verify-email', async ({ body, cookie, request, server }) => {
      limit(`verify:${ipOf(server, request, config.trustProxyIp)}`, 10, 15 * 60_000);
      await registration.verify(body.token, cookie.registration.value as string | undefined, body.contrasenia);
      clearCookie(cookie.registration, config, '/api/auth/verify-email');
      return { message: 'Correo verificado. Ya puedes iniciar sesión' };
    }, { body: t.Object({ token, contrasenia: t.Optional(t.String()) }, strict) });
}
