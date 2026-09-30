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
  registrationVerified: 'fn_registration_verified',
  googleUser: 'fn_google_user',
  googleUserCreate: 'fn_google_user_create',
  googleIdentityAdd: 'fn_google_identity_add',
  googleIdentityOwner: 'fn_google_identity_owner',
  googleIdentityForUser: 'fn_google_identity_for_user',
  authTokenCreate: 'fn_auth_token_create',
  authTokenGet: 'fn_auth_token_get',
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
  sessionRecentlyRotated: 'fn_session_recently_rotated',
  sessionRevoke: 'fn_session_revoke',
  limitCheck: 'fn_limit_check',
  limitFail: 'fn_limit_fail',
  limitClear: 'fn_limit_clear',
  limitClearEmail: 'fn_limit_clear_email',
  limitBlock: 'fn_limit_block',
  limitAttackers: 'fn_limit_attackers',
  profileUpdate: 'fn_profile_update',
  userPermissions: 'fn_user_permissions',
  userById: 'fn_user_by_id',
  adminUsers: 'fn_admin_users',
  roleChange: 'fn_role_change',
  userStateChange: 'fn_user_state_change',
  textsList: 'fn_texts_list',
  textSave: 'fn_text_save',
  proposalsList: 'fn_proposals_list',
  proposalSave: 'fn_proposal_save',
  biographyList: 'fn_biography_list',
  biographySave: 'fn_biography_save',
  worksList: 'fn_works_list',
  workSave: 'fn_work_save',
  mediaCreate: 'fn_media_create',
  mediaByIds: 'fn_media_by_ids',
  mediaByHash: 'fn_media_by_hash',
  publicationCreate: 'fn_publication_create',
  publicationsList: 'fn_publications_list',
  publicationLatest: 'fn_publication_latest',
  contentVersions: 'fn_content_versions',
  publicationCurrent: 'fn_publication_current',
  publicationClaim: 'fn_publication_claim',
  publicationFinish: 'fn_publication_finish',
  publicationRecover: 'fn_publication_recover',
  masterCreate: 'fn_master_create',
  masterTransfer: 'fn_master_transfer',
} as const;

export type PgFunction = keyof typeof names;

/**
 * Ejecuta una función PostgreSQL permitida con parámetros enlazados.
 * Los objetos y arreglos de objetos van tal cual a parámetros jsonb. Las listas de números
 * van como texto «1,2,3»: el driver de Bun 1.3 se cae al enlazar arreglos numéricos.
 */
export function callPg<T extends object = Record<string, unknown>>(
  db: SQL, functionName: PgFunction, values: unknown[] = [],
): Promise<T[]> {
  if (!Object.hasOwn(names, functionName)) throw new Error('Función PostgreSQL no permitida');
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  return db.unsafe<T[]>(`SELECT * FROM ${names[functionName]}(${placeholders})`, values);
}
