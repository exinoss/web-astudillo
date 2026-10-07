import type { Account, AuthRepository, PendingGoogleRegistration, Profile, RegistrationInput } from '../auth-repository';
import type { AceptacionLegal } from '../../legal/legal';
import { apiRequest } from './api-client';

export class HttpAuthRepository implements AuthRepository {
  async register(input: RegistrationInput) {
    await apiRequest('/api/auth/register', 'POST', input);
  }

  async verifyEmail(token: string) {
    await apiRequest('/api/auth/verify-email', 'POST', { token });
  }

  async login(correo: string, contrasenia: string): Promise<'ready' | 'link'> {
    const result = await apiRequest<{ enlace?: true }>('/api/auth/login', 'POST', { correo, contrasenia });
    return result.enlace ? 'link' : 'ready';
  }

  async confirmLogin(token: string) {
    await apiRequest('/api/auth/login/confirm', 'POST', { token });
  }

  async googleLogin(credential: string, aceptacion?: AceptacionLegal) {
    const result = await apiRequest<PendingGoogleRegistration | { user: Account }>('/api/auth/google', 'POST', { credential, aceptacion });
    return 'requiereAceptacion' in result ? result : null;
  }

  async acceptTerms(aceptacion: AceptacionLegal) {
    await apiRequest('/api/auth/accept-terms', 'POST', { aceptacion }, true);
  }

  async requestReset(correo: string) {
    await apiRequest('/api/auth/password/reset-request', 'POST', { correo });
  }

  async resetPassword(token: string, contrasenia: string) {
    await apiRequest('/api/auth/password/reset', 'POST', { token, contrasenia });
  }

  async addPassword(credential: string, contrasenia: string) {
    await apiRequest('/api/auth/password', 'POST', { credential, contrasenia }, true);
  }

  async changePassword(input: { contraseniaActual: string; contraseniaNueva: string;
    confirmarContrasenia: string }) {
    await apiRequest('/api/auth/password/change', 'POST', input, true);
  }

  getProfile() {
    return apiRequest<Profile>('/api/me', 'GET', undefined, true);
  }

  updateProfile(input: { nombresCompletos: string; direccion?: string; versionPerfil: number }) {
    return apiRequest<Account & { versionPerfil: number }>('/api/me', 'PATCH', input, true);
  }

  async logout() {
    await apiRequest('/api/auth/logout', 'POST');
  }
}
