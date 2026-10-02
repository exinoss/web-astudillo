import { Elysia, t } from 'elysia';
import { publicAccount } from '../../http';
import { clearSession, email, ipOf, redirectToAccount, setSession, strict, token, type AuthContext } from './common';

const LINK_SENT = 'Por seguridad te enviamos un enlace a tu correo para terminar de entrar';

export function sessionRoutes(context: AuthContext) {
  const { login, sessions, config } = context;
  return new Elysia({ prefix: '/api/auth', normalize: false })
    // Los fallos se limitan en PostgreSQL con sanción progresiva (services/limits.ts, createAttempts).
    .post('/login', async ({ body, cookie, request, server }) => {
      const result = await login.login(body.correo, body.contrasenia, ipOf(server, request, config.trustProxyIp));
      if ('link' in result) return { enlace: true, message: LINK_SENT };
      setSession(context, cookie, result.tokens);
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ correo: email, contrasenia: t.String({ maxLength: 128 }) }, strict) })
    .get('/login/confirm', ({ query }) => redirectToAccount(config.origin, '/cuenta/acceso/', query.token),
      { query: t.Object({ token }) })
    .post('/login/confirm', async ({ body, cookie }) => {
      const result = await login.confirm(body.token);
      setSession(context, cookie, result.tokens);
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ token }, strict) })
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
