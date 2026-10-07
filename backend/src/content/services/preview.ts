import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import type { Security } from '../../security/types';
import type { createContent } from './content';

type PreviewState = 'en_cola' | 'compilando' | 'lista' | 'fallida';

export function createPreview(sql: SQL, authorization: Authorization, security: Security, content: ReturnType<typeof createContent>) {
  return {
    async request(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const [row] = await callPg<{ estado: PreviewState }>(sql, 'previewRequest', [actor.id_usuario, await content.draftSite()]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return { estado: row.estado };
    },

    async state(access: string | undefined) {
      await authorization.require(access, PERMISSIONS.contentEdit);
      const [row] = await callPg<{ estado: PreviewState }>(sql, 'previewState');
      return { estado: row?.estado ?? null };
    },

    async pass(access: string | undefined) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      return security.signPreview(actor.id_usuario);
    },

    /** El pase es válido y su cuenta sigue activa y con permiso para editar el contenido. */
    async allowed(pass: string | undefined) {
      const id = await security.verifyPreview(pass);
      if (!id) return false;
      return (await callPg(sql, 'authorizedUser', [id, PERMISSIONS.contentEdit])).length > 0;
    },
  };
}
