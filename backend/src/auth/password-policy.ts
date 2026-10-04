import { ApiError } from '../http';

// El límite de 128 evita abusos al calcular el hash.
export function requireNewPassword(value: string) {
  const length = Array.from(value).length;
  if (length < 6 || length > 128 ||
    !/\p{L}/u.test(value) || !/[0-9]/.test(value) ||
    !/[^\p{L}\p{N}\s]/u.test(value)) {
    throw new ApiError(422, 'La contraseña debe tener al menos 6 caracteres e incluir una letra, un número y un símbolo');
  }
  const normalized = value.replace(/[A-Z]/g, letter => letter.toLowerCase());
  const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];
  for (let i = 0; i <= normalized.length - 4; i++) {
    if (sequences.some(sequence => sequence.includes(normalized.slice(i, i + 4)))) {
      throw new ApiError(422, 'Evita secuencias de 4 o más letras o números, como abcd o 1234');
    }
  }
}

export function requireConfirmation(password: string, confirmation: string) {
  if (password !== confirmation) throw new ApiError(422, 'Las contraseñas no coinciden');
}
