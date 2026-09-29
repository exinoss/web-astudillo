export const PERMISSIONS = {
  profileView: 'perfil.ver',
  profileEdit: 'perfil.editar',
  passwordAdd: 'cuenta.contrasenia.agregar',
  passwordChange: 'cuenta.contrasenia.cambiar',
  contentEdit: 'contenido.editar',
  contentPublish: 'contenido.publicar',
  mediaUpload: 'medios.subir',
  usersView: 'usuarios.ver',
  usersRoleChange: 'usuarios.rol.cambiar',
  usersStateChange: 'usuarios.estado.cambiar',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
