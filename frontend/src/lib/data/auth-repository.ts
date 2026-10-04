import type { AceptacionLegal } from '../legal';

export interface Account {
  id: number;
  correo: string;
  nombresCompletos: string | null;
  direccion: string | null;
  rol: string;
}

export interface Profile extends Account {
  terminosAceptados: boolean;
  versionPerfil: number;
  tieneContrasenia: boolean;
  tieneGoogle: boolean;
  permisos: string[];
}

export interface RegistrationInput {
  nombresCompletos: string;
  direccion?: string;
  correo: string;
  contrasenia: string;
  confirmarContrasenia: string;
  aceptacion: AceptacionLegal;
}

export interface PendingGoogleRegistration {
  requiereAceptacion: true;
  correo: string;
  nombresCompletos: string | null;
}

export interface AuthRepository {
  register(input: RegistrationInput): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  /** 'link': por seguridad el acceso termina con un enlace enviado al correo. */
  login(correo: string, contrasenia: string): Promise<'ready' | 'link'>;
  confirmLogin(token: string): Promise<void>;
  /** Solo cuentas de Google con correo de Gmail o Google Workspace; con otro correo, error 422. */
  googleLogin(credential: string, aceptacion?: AceptacionLegal): Promise<PendingGoogleRegistration | null>;
  acceptTerms(aceptacion: AceptacionLegal): Promise<void>;
  requestReset(correo: string): Promise<void>;
  resetPassword(token: string, contrasenia: string): Promise<void>;
  addPassword(credential: string, contrasenia: string): Promise<void>;
  changePassword(input: { contraseniaActual: string; contraseniaNueva: string;
    confirmarContrasenia: string }): Promise<void>;
  getProfile(): Promise<Profile>;
  updateProfile(input: { nombresCompletos: string; direccion?: string; versionPerfil: number }): Promise<Account & { versionPerfil: number }>;
  logout(): Promise<void>;
}
