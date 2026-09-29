export const ASSIGNABLE_ROLES = ['votante', 'coadmin', 'admin'] as const;
export type AssignableRole = typeof ASSIGNABLE_ROLES[number];
export const ACCOUNT_STATES = ['activo', 'bloqueado'] as const;
export type AccountState = typeof ACCOUNT_STATES[number];

// Un solo mensaje para cualquier bloqueo: no revela qué cuenta es la maestra ni cómo se gestiona.
export const FORBIDDEN_ACCOUNT = 'No tienes permiso para modificar esta cuenta';
const OWN_ACCOUNT = 'No puedes modificar tu propia cuenta';

type Account = { id_usuario: number; rol: string; es_maestro: boolean };

/**
 * Indica si `actor` puede cambiar el rol o el estado de `target`.
 * Es la misma regla que aplican `fn_role_change` y `fn_user_state_change` en PostgreSQL.
 */
export function accountRule(actor: Account, target: Account): { allowed: true } | { allowed: false; reason: string } {
  if (actor.id_usuario === target.id_usuario) return { allowed: false, reason: OWN_ACCOUNT };
  if (target.es_maestro || (target.rol === 'admin' && !actor.es_maestro))
    return { allowed: false, reason: FORBIDDEN_ACCOUNT };
  return { allowed: true };
}
