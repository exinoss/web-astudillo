import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import type { UserRow } from '../../db/types';
import { ApiError } from '../../http';
import { accountRule, ASSIGNABLE_ROLES, type AccountState, type AssignableRole } from './hierarchy';

export const PAGE_SIZE = 20;

type AdminUserRow = Pick<UserRow, 'id_usuario' | 'correo' | 'nombres_completos' | 'rol' | 'es_maestro' | 'estado'>
  & { total: string };

export interface UserFilters {
  q?: string;
  rol?: string;
  estado?: AccountState;
  pagina: number;
}

/** Crea la consulta, el cambio de rol y la activación de cuentas del panel. */
export function createAdminUsers(sql: SQL, authorization: Authorization) {
  /** Carga la cuenta objetivo y aplica la jerarquía antes de tocar la base. */
  async function target(actor: UserRow, targetId: number) {
    const [row] = await callPg<UserRow>(sql, 'userById', [targetId]);
    if (!row) throw new ApiError(404, 'Cuenta no encontrada');
    const rule = accountRule(actor, row);
    if (!rule.allowed) throw new ApiError(403, rule.reason);
    return row;
  }

  return {
    /** Lista cuentas filtradas con lo que el actor puede hacer en cada una. */
    async list(access: string | undefined, filters: UserFilters) {
      const actor = await authorization.require(access, PERMISSIONS.usersView);
      const term = filters.q?.trim() ? filters.q.trim().replace(/[\\%_]/g, '\\$&') : null;
      const rows = await callPg<AdminUserRow>(sql, 'adminUsers', [
        term, filters.rol ?? null, filters.estado ?? null, PAGE_SIZE, (filters.pagina - 1) * PAGE_SIZE,
      ]);
      return {
        total: Number(rows[0]?.total ?? 0),
        pagina: filters.pagina,
        porPagina: PAGE_SIZE,
        // Una página vacía llega como una sola fila con el total y la cuenta en nulo.
        usuarios: rows.filter(row => row.id_usuario !== null).map(row => {
          const rule = accountRule(actor, row);
          return {
            id: row.id_usuario, correo: row.correo, nombresCompletos: row.nombres_completos,
            rol: row.rol, estado: row.estado,
            // Solo el propio maestro sabe cuál es la cuenta maestra; para el resto es un admin más.
            ...(actor.es_maestro ? { esMaestro: row.es_maestro } : {}),
            rolesAsignables: rule.allowed ? ASSIGNABLE_ROLES : [],
            puedeCambiarEstado: rule.allowed,
            motivoBloqueo: rule.allowed ? null : rule.reason,
          };
        }),
      };
    },

    /** Cambia el rol; la base repite la comprobación dentro de la transacción. */
    async changeRole(access: string | undefined, targetId: number, role: AssignableRole, expected: string) {
      const actor = await authorization.require(access, PERMISSIONS.usersRoleChange);
      await target(actor, targetId);
      const [updated] = await callPg<UserRow>(sql, 'roleChange', [actor.id_usuario, targetId, role, expected]);
      // Otro admin cambió la cuenta desde que se cargó la lista (`expected` ya no es su rol).
      if (!updated) throw new ApiError(409, 'La cuenta cambió mientras tanto; recarga la lista');
      return { id: updated.id_usuario, rol: updated.rol, estado: updated.estado };
    },

    /** Activa o desactiva la cuenta; al desactivarla se cierran sus sesiones. */
    async changeState(access: string | undefined, targetId: number, state: AccountState, expected: string) {
      const actor = await authorization.require(access, PERMISSIONS.usersStateChange);
      await target(actor, targetId);
      const [updated] = await callPg<UserRow>(sql, 'userStateChange', [actor.id_usuario, targetId, state, expected]);
      if (!updated) throw new ApiError(409, 'La cuenta cambió mientras tanto; recarga la lista');
      return { id: updated.id_usuario, rol: updated.rol, estado: updated.estado };
    },
  };
}
