import { Elysia, t } from 'elysia';
import { publicAccount } from '../../http';
import { normalizeEmail } from '../../security';
import { clearSession, email, ipOf, setSession, strict, type AuthContext } from './common';

/** Expone inicio, renovación y cierre de sesión mediante cookies HttpOnly. */
export function sessionRoutes(context: AuthContext) {
  const { passwords, sessions, limit, config } = context;
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/login', async ({ body, cookie, request, server }) => {
      const ip = ipOf(server, request, config.trustProxyIp), correo = normalizeEmail(body.correo);
      limit(`login:email:${correo}`, 5, 15 * 60_000);
      limit(`login:ip:${ip}`, 20, 15 * 60_000);
      const result = await passwords.login(body.correo, body.contrasenia);
      limit.clear(`login:email:${correo}`);
      limit.clear(`login:ip:${ip}`);
      setSession(context, cookie, result.tokens);
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ correo: email, contrasenia: t.String() }, strict) })
    .post('/refresh', async ({ cookie }) => {
      const result = await sessions.renew(cookie.refresh.value as string | undefined);
      setSession(context, cookie, result);
      return { user: publicAccount(result.user) };
    })
    .post('/logout', async ({ cookie }) => {
      await sessions.revoke(cookie.refresh.value as string | undefined);
      clearSession(context, cookie);
      return { ok: true };
    });
}
