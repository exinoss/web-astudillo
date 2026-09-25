export interface Account {
  id: number;
  correo: string;
  nombresCompletos: string | null;
  direccion: string | null;
  rol: string;
}

export interface Profile extends Account {
  tieneContrasenia: boolean;
  tieneGoogle: boolean;
}

export interface AuthRepository {
  register(input: { nombresCompletos: string; direccion?: string; correo: string; contrasenia: string;
    confirmarContrasenia: string }): Promise<void>;
  verifyEmail(token: string, contrasenia?: string): Promise<void>;
  login(correo: string, contrasenia: string): Promise<void>;
  googleLogin(credential: string): Promise<'pending' | 'ready'>;
  confirmGoogle(token: string, credential?: string): Promise<void>;
  requestReset(correo: string): Promise<void>;
  resetPassword(token: string, contrasenia: string): Promise<void>;
  addPassword(credential: string, contrasenia: string): Promise<void>;
  changePassword(input: { contraseniaActual: string; contraseniaNueva: string;
    confirmarContrasenia: string }): Promise<void>;
  getProfile(): Promise<Profile>;
  updateProfile(input: { nombresCompletos: string; direccion?: string }): Promise<Account>;
  logout(): Promise<void>;
}
