import { passwordProblem } from '../../../../../backend/src/contracts/password';

const MESSAGES = {
  composicion: 'La contraseña debe tener al menos 6 caracteres e incluir una letra, un número y un símbolo.',
  sucesion: 'Evita secuencias de 4 o más letras o números, como abcd o 1234.',
};

export function requirePassword(password: string, confirmation: string) {
  const problem = passwordProblem(password);
  if (problem) throw new Error(MESSAGES[problem]);
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
}
