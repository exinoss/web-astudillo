import { Elysia, t } from 'elysia';
import { PERMISSIONS } from '../permissions';
import { acceptTerms } from '../services/consent';
import { acceptance, strict } from './common';
import type { SQL } from 'bun';
import type { Authorization } from '../types';

export function consentRoutes(sql: SQL, authorization: Authorization) {
  return new Elysia({ prefix: '/api/auth', normalize: false })
    .post('/accept-terms', async ({ cookie, body }) => {
      const user = await authorization.require(cookie.access.value as string | undefined, PERMISSIONS.profileView);
      return acceptTerms(sql, user.id_usuario, body.aceptacion);
    }, { body: t.Object({ aceptacion: acceptance }, strict) });
}
