import { Elysia, t } from 'elysia';
import { publicAccount } from '../../http';
import { acceptance, googleCredential, ipOf, setSession, strict, type AuthContext } from './common';

export function googleRoutes(context: AuthContext) {
  const { config, google, limit } = context;
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/google', async ({ body, cookie, request, server }) => {
      limit(`google:${ipOf(server, request, config.trustProxyIp)}`, 20, 15 * 60_000);
      // Un acierto no limpia el contador de la IP: si no, una cuenta propia serviría para saltárselo.
      const result = await google.login(body.credential, body.aceptacion);
      if ('requiereAceptacion' in result) return result;
      setSession(context, cookie, result.tokens);
      return { user: publicAccount(result.user) };
    }, { body: t.Object({ credential: googleCredential, aceptacion: t.Optional(acceptance) }, strict) });
}
