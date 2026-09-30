import type { Config } from '../config';
import type { createAuthorization } from './services/authorization';
import type { createGoogleAuth } from './services/google';
import type { createAttempts, createLimiter } from './services/limits';
import type { createLogin } from './services/login';
import type { createPasswords } from './services/passwords';
import type { createRegistration } from './services/registration';
import type { createSessions } from './services/sessions';

export type Authorization = ReturnType<typeof createAuthorization>;
export type Registration = ReturnType<typeof createRegistration>;
export type GoogleAuth = ReturnType<typeof createGoogleAuth>;
export type Passwords = ReturnType<typeof createPasswords>;
export type Sessions = ReturnType<typeof createSessions>;
export type Limiter = ReturnType<typeof createLimiter>;
export type Attempts = ReturnType<typeof createAttempts>;
export type Login = ReturnType<typeof createLogin>;

export interface RegistrationInput {
  nombresCompletos: string;
  direccion?: string;
  correo: string;
  contrasenia: string;
  confirmarContrasenia: string;
}

export type AuthContext = {
  config: Config;
  authorization: Authorization;
  registration: Registration;
  google: GoogleAuth;
  passwords: Passwords;
  login: Login;
  sessions: Sessions;
  limit: Limiter;
};
