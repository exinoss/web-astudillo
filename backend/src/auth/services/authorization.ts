import type { SQL } from 'bun';
import { callPg } from '../../db/call';
import type { UserRow } from '../../db/types';
import { ApiError } from '../../http';
import type { Security } from '../../security/types';
import type { Permission } from '../permissions';

/** Crea la verificación conjunta de JWT, estado de cuenta y permiso vigente. */
export function createAuthorization(sql: SQL, security: Security) {
  return {
    /** Devuelve el usuario autorizado o distingue sesión inválida de permiso denegado. */
    async require(access: string | undefined, permission: Permission): Promise<UserRow> {
      const id = await security.verifyAccess(access);
      if (!id) throw new ApiError(401, 'Inicia sesión');
      const [user] = await callPg<UserRow>(sql, 'authorizedUser', [id, permission]);
      if (user) return user;
      const active = await callPg<UserRow>(sql, 'activeUser', [id]);
      if (!active.length) throw new ApiError(401, 'Cuenta no disponible');
      throw new ApiError(403, 'Permiso insuficiente');
    },
  };
}
