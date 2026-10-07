export function requirePassword(password: string, confirmation: string) {
  const size = Array.from(password).length;
  if (size < 6 || size > 128 || !/\p{L}/u.test(password) || !/[0-9]/.test(password) ||
    !/[^\p{L}\p{N}\s]/u.test(password)) {
    throw new Error('La contraseña debe tener al menos 6 caracteres e incluir una letra, un número y un símbolo.');
  }
  const normalized = password.replace(/[A-Z]/g, letter => letter.toLowerCase());
  const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];
  for (let i = 0; i <= normalized.length - 4; i++) {
    if (sequences.some(sequence => sequence.includes(normalized.slice(i, i + 4)))) {
      throw new Error('Evita secuencias de 4 o más letras o números, como abcd o 1234.');
    }
  }
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
}
