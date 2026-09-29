import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import { ACCOUNT_STATES, ASSIGNABLE_ROLES } from '../services/hierarchy';
import { createAdminUsers } from '../services/users';

const literals = (values: readonly string[]) => t.Union(values.map(value => t.Literal(value)));
const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;

/** Rutas del panel de administración protegidas por permiso. */
export function adminRoutes(sql: SQL, authorization: Authorization) {
  const users = createAdminUsers(sql, authorization);
  return new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/usuarios', ({ cookie, query }) => users.list(access(cookie), { ...query, pagina: query.pagina ?? 1 }), {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 120 })),
        rol: t.Optional(literals(['votante', 'analista', 'coadmin', 'admin'])),
        estado: t.Optional(literals(ACCOUNT_STATES)),
        pagina: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
      }, { additionalProperties: false }),
    })
    .patch('/usuarios/:id/rol', ({ cookie, params, body }) => users.changeRole(access(cookie), params.id, body.rol), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ rol: literals(ASSIGNABLE_ROLES) }, { additionalProperties: false }),
    })
    .patch('/usuarios/:id/estado', ({ cookie, params, body }) => users.changeState(access(cookie), params.id, body.estado), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ estado: literals(ACCOUNT_STATES) }, { additionalProperties: false }),
    });
}
