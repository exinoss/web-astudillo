import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import type { UserRow } from '../../db/types';
import { ApiError, publicAccount } from '../../http';
import type { ProfileUpdateInput } from '../types';

/** Crea lectura y actualización de perfil protegidas por permisos. */
export function createProfile(sql: SQL, authorization: Authorization) {
  return {
    /** Devuelve datos públicos del perfil e indicadores de métodos de acceso. */
    async get(access: string | undefined) {
      const user = await authorization.require(access, PERMISSIONS.profileView);
      const [methods] = await callPg<{ tiene_contrasenia: boolean; tiene_google: boolean }>(
        sql, 'accountMethods', [user.id_usuario],
      );
      return { ...publicAccount(user), tieneContrasenia: methods.tiene_contrasenia,
        tieneGoogle: methods.tiene_google };
    },
    /** Actualiza solo nombre y dirección tras validar el permiso de edición. */
    async update(access: string | undefined, input: ProfileUpdateInput) {
      const user = await authorization.require(access, PERMISSIONS.profileEdit);
      const name = input.nombresCompletos.trim();
      if (!name) throw new ApiError(422, 'Nombre requerido');
      const [updated] = await callPg<UserRow>(sql, 'profileUpdate', [
        user.id_usuario, name, input.direccion?.trim() || null,
      ]);
      if (!updated) throw new ApiError(403, 'Permiso insuficiente');
      return publicAccount(updated);
    },
  };
}
