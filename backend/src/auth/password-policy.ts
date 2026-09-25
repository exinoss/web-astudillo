import { ApiError } from '../http';

/** Rechaza contraseñas fuera de longitud o sin letra, número y símbolo. */
export function requireNewPassword(value: string) {
  const length = Array.from(value).length;
  if (length < 6 || length > 128 ||
    !/\p{L}/u.test(value) || !/[0-9]/.test(value) ||
    !/[^\p{L}\p{N}\s]/u.test(value)) {
    throw new ApiError(422, 'La contraseña debe tener de 6 a 128 caracteres, una letra, un número y un símbolo');
  }
}

/** Exige que la confirmación coincida exactamente con la contraseña. */
export function requireConfirmation(password: string, confirmation: string) {
  if (password !== confirmation) throw new ApiError(422, 'Las contraseñas no coinciden');
}
