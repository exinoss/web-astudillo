export const PERMISSIONS = {
  profileView: 'perfil.ver',
  profileEdit: 'perfil.editar',
  passwordAdd: 'cuenta.contrasenia.agregar',
  passwordChange: 'cuenta.contrasenia.cambiar',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
