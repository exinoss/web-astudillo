import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { callPg } from '../../db/call';
import type { UserRow } from '../../db/types';
import { ApiError, publicAccount } from '../../http';
import type { ProfileUpdateInput } from '../types';
import { hasAcceptance } from '../../auth/services/consent';

export function createProfile(sql: SQL, authorization: Authorization) {
  return {
    /** Devuelve datos públicos del perfil e indicadores de métodos de acceso. */
    async get(access: string | undefined) {
      const user = await authorization.require(access, PERMISSIONS.profileView);
      const [[methods], permissions, terminosAceptados] = await Promise.all([
        callPg<{ tiene_contrasenia: boolean; tiene_google: boolean }>(sql, 'accountMethods', [user.id_usuario]),
        callPg<{ codigo: string }>(sql, 'userPermissions', [user.id_usuario]),
        hasAcceptance(sql, user.id_usuario),
      ]);
      return { ...publicAccount(user), terminosAceptados, versionPerfil: user.version_perfil, tieneContrasenia: methods.tiene_contrasenia,
        tieneGoogle: methods.tiene_google, permisos: permissions.map(p => p.codigo) };
    },
    /** Actualiza solo nombre y dirección tras validar el permiso de edición. */
    async update(access: string | undefined, input: ProfileUpdateInput) {
      const user = await authorization.require(access, PERMISSIONS.profileEdit);
      if (input.versionPerfil === undefined) throw new ApiError(409, 'Recarga la página antes de guardar tus datos');
      const name = input.nombresCompletos.trim();
      if (!name) throw new ApiError(422, 'Nombre requerido');
      const [updated] = await callPg<{ resultado: string; usuario: UserRow; version_perfil: number }>(sql, 'profileUpdate', [
        user.id_usuario, name, input.direccion?.trim() || null, input.versionPerfil,
      ]);
      if (!updated) throw new ApiError(403, 'Permiso insuficiente');
      if (updated.resultado === 'conflicto') throw new ApiError(409, 'Tus datos cambiaron. Recarga la página y revísalos antes de guardar');
      return { ...publicAccount(updated.usuario),
        versionPerfil: updated.version_perfil };
    },
  };
}
