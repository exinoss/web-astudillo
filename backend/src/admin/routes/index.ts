import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import { ipOf } from '../../auth/routes/common';
import { access } from '../../http';
import { literals, pagina, strict } from '../../validation/esquemas';
import type { Authorization, Confirmation } from '../../auth/types';
import { ACCOUNT_STATES, ASSIGNABLE_ROLES } from '../services/hierarchy';
import { createAdminUsers } from '../services/users';
import { LARGOS } from '../../contracts/limites';
import { ROLES } from '../../contracts/roles';

/** La contraseña de quien hace el cambio o el código enviado a su correo. */
const confirmacion = t.String({ minLength: 1, maxLength: LARGOS.cuenta.contrasenia });

export function adminRoutes(sql: SQL, authorization: Authorization, confirmation: Confirmation, trustProxyIp: boolean) {
  const users = createAdminUsers(sql, authorization, confirmation);
  return new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/usuarios', ({ cookie, query }) => users.list(access(cookie), { ...query, pagina: query.pagina ?? 1 }), {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: LARGOS.busquedaUsuarios })),
        rol: t.Optional(literals(ROLES)),
        estado: t.Optional(literals(ACCOUNT_STATES)),
        pagina,
      }, strict),
    })
    // `rolAnterior` / `estadoAnterior`: lo que se veía en la lista; si ya no es así, otro admin cambió la cuenta (409).
    .patch('/usuarios/:id/rol', ({ cookie, params, body, server, request }) =>
      users.changeRole(access(cookie), params.id, body.rol, body.rolAnterior, body.confirmacion, ipOf(server, request, trustProxyIp)), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ rol: literals(ASSIGNABLE_ROLES), rolAnterior: literals(ROLES), confirmacion }, strict),
    })
    .patch('/usuarios/:id/estado', ({ cookie, params, body, server, request }) =>
      users.changeState(access(cookie), params.id, body.estado, body.estadoAnterior, body.confirmacion, ipOf(server, request, trustProxyIp)), {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ estado: literals(ACCOUNT_STATES), estadoAnterior: literals(ACCOUNT_STATES), confirmacion }, strict),
    })
    .post('/confirmacion/codigo', async ({ cookie }) => {
      await users.sendConfirmationCode(access(cookie));
      return { ok: true };
    });
}
