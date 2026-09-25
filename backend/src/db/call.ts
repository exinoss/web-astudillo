import type { SQL } from 'bun';

const names = {
  cleanupTokens: 'fn_cleanup_tokens',
  userByEmail: 'fn_user_by_email',
  userByEmailLocked: 'fn_user_by_email_locked',
  activeUser: 'fn_active_user',
  authorizedUser: 'fn_authorized_user',
  accountMethods: 'fn_account_methods',
  pendingCreate: 'fn_pending_create',
  pendingGet: 'fn_pending_get',
  registrationComplete: 'fn_registration_complete',
  googleUser: 'fn_google_user',
  googleUserCreate: 'fn_google_user_create',
  googleIdentityAdd: 'fn_google_identity_add',
  googleIdentityOwner: 'fn_google_identity_owner',
  googleIdentityForUser: 'fn_google_identity_for_user',
  authTokenCreate: 'fn_auth_token_create',
  authTokenGet: 'fn_auth_token_get',
  googleTokenGet: 'fn_google_token_get',
  authTokenConsume: 'fn_auth_token_consume',
  authTokenDelete: 'fn_auth_token_delete',
  passwordUser: 'fn_password_user',
  resetTarget: 'fn_reset_target',
  passwordReset: 'fn_password_reset',
  passwordChangeTarget: 'fn_password_change_target',
  passwordChange: 'fn_password_change',
  passwordAdd: 'fn_password_add',
  sessionCreate: 'fn_session_create',
  sessionRotate: 'fn_session_rotate',
  sessionRevoke: 'fn_session_revoke',
  profileUpdate: 'fn_profile_update',
} as const;

export type PgFunction = keyof typeof names;

/** Ejecuta una función PostgreSQL permitida con parámetros enlazados. */
export function callPg<T extends object = Record<string, unknown>>(
  db: SQL, functionName: PgFunction, values: unknown[] = [],
): Promise<T[]> {
  if (!Object.hasOwn(names, functionName)) throw new Error('Función PostgreSQL no permitida');
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  return db.unsafe<T[]>(`SELECT * FROM ${names[functionName]}(${placeholders})`, values);
}
