import { Elysia, t } from 'elysia';
import { cookieOptions, publicAccount } from '../../http';
import { clearCookie, ipOf, redirectToAccount, setSession, strict, token, type AuthContext } from './common';

/** Expone acceso Google y confirmación adicional para correos no autoritativos. */
export function googleRoutes(context: AuthContext) {
  const { config, google, limit } = context;
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/google', async ({ body, cookie, request, server }) => {
      limit(`google:${ipOf(server, request, config.trustProxyIp)}`, 20, 15 * 60_000);
      const result = await google.login(body.credential);
      limit.clear(`google:${ipOf(server, request, config.trustProxyIp)}`);
      if ('pending' in result) {
        cookie.googleChallenge.set({ value: result.browser,
          ...cookieOptions(config, 900, '/api/auth/google/confirm') });
        return { pending: true };
      }
      setSession(context, cookie, result.tokens);
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ credential: t.String({ minLength: 100 }) }, strict) })
    .get('/google/confirm', ({ query }) =>
      redirectToAccount(config.origin, '/cuenta/google/confirmar/', query.token),
      { query: t.Object({ token }) })
    .post('/google/confirm', async ({ body, cookie }) => {
      const result = await google.confirm(body.token, cookie.googleChallenge.value as string | undefined, body.credential);
      setSession(context, cookie, result.tokens);
      clearCookie(cookie.googleChallenge, config, '/api/auth/google/confirm');
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ token, credential: t.Optional(t.String({ minLength: 100 })) }, strict) });
}
