import { passwordProblem } from '../contracts/password';
import { ApiError } from '../http';

const MESSAGES = {
  composicion: 'La contraseña debe tener al menos 6 caracteres e incluir una letra, un número y un símbolo',
  sucesion: 'Evita secuencias de 4 o más letras o números, como abcd o 1234',
};

export function requireNewPassword(value: string) {
  const problem = passwordProblem(value);
  if (problem) throw new ApiError(422, MESSAGES[problem]);
}

export function requireConfirmation(password: string, confirmation: string) {
  if (password !== confirmation) throw new ApiError(422, 'Las contraseñas no coinciden');
}
