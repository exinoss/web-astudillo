import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import { ipOf } from '../../auth/routes/common';
import type { Authorization, Confirmation } from '../../auth/types';
import { ACCOUNT_STATES, ASSIGNABLE_ROLES } from '../services/hierarchy';
import { createAdminUsers } from '../services/users';

const literals = (values: readonly string[]) => t.Union(values.map(value => t.Literal(value)));
const access = (cookie: Record<string, { value?: unknown }>) => cookie.access.value as string | undefined;
const ALL_ROLES = ['votante', 'analista', 'coadmin', 'admin'];
/** La contraseña de quien hace el cambio o el código enviado a su correo. */
const confirmacion = t.String({ minLength: 1, maxLength: 128 });

export function adminRoutes(sql: SQL, authorization: Authorization, confirmation: Confirmation, trustProxyIp: boolean) {
  const users = createAdminUsers(sql, authorization, confirmation);
  return new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/usuarios', ({ cookie, query }) => users.list(access(cookie), { ...query, pagina: query.pagina ?? 1 }), {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 120 })),
        rol: t.Optional(literals(ALL_ROLES)),
        estado: t.Optional(literals(ACCOUNT_STATES)),
        pagina: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
      }, { additionalProperties: false }),
    })
    // `rolAnterior` / `estadoAnterior`: lo que se veía en la lista; si ya no es así, otro admin cambió la cuenta (409).
    .patch('/usuarios/:id/rol', ({ cookie, params, body, server, request }) =>
      users.changeRole(access(cookie), params.id, body.rol, body.rolAnterior, body.confirmacion, ipOf(server, request, trustProxyIp)), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ rol: literals(ASSIGNABLE_ROLES), rolAnterior: literals(ALL_ROLES), confirmacion }, { additionalProperties: false }),
    })
    .patch('/usuarios/:id/estado', ({ cookie, params, body, server, request }) =>
      users.changeState(access(cookie), params.id, body.estado, body.estadoAnterior, body.confirmacion, ipOf(server, request, trustProxyIp)), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ estado: literals(ACCOUNT_STATES), estadoAnterior: literals(ACCOUNT_STATES), confirmacion }, { additionalProperties: false }),
    })
    .post('/confirmacion/codigo', async ({ cookie }) => {
      await users.sendConfirmationCode(access(cookie));
      return { ok: true };
    });
}
