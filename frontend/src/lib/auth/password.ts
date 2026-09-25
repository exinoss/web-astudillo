/** Aplica la política local de contraseña y valida su confirmación. */
export function requirePassword(password: string, confirmation: string) {
  const size = Array.from(password).length;
  if (size < 6 || size > 128 || !/\p{L}/u.test(password) || !/[0-9]/.test(password) ||
    !/[^\p{L}\p{N}\s]/u.test(password)) {
    throw new Error('La contraseña debe tener de 6 a 128 caracteres, una letra, un número y un símbolo.');
  }
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
}
