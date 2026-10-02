import type { Account, AuthRepository, Profile } from '../auth-repository';
import { apiRequest } from './api-client';

export class HttpAuthRepository implements AuthRepository {
  async register(input: { nombresCompletos: string; direccion?: string; correo: string; contrasenia: string;
    confirmarContrasenia: string }) {
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

  async googleLogin(credential: string) {
    await apiRequest('/api/auth/google', 'POST', { credential });
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

  updateProfile(input: { nombresCompletos: string; direccion?: string }) {
    return apiRequest<Account>('/api/me', 'PATCH', input, true);
  }

  async logout() {
    await apiRequest('/api/auth/logout', 'POST');
  }
}
