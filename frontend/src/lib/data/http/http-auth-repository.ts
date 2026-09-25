import type { Account, AuthRepository, Profile } from '../auth-repository';
import { apiRequest } from './api-client';

/** Adapta el contrato de autenticación a los endpoints HTTP del backend. */
export class HttpAuthRepository implements AuthRepository {
  async register(input: { nombresCompletos: string; direccion?: string; correo: string; contrasenia: string;
    confirmarContrasenia: string }) {
    await apiRequest('/api/auth/register', 'POST', input);
  }

  async verifyEmail(token: string, contrasenia?: string) {
    await apiRequest('/api/auth/verify-email', 'POST', { token, ...(contrasenia ? { contrasenia } : {}) });
  }

  async login(correo: string, contrasenia: string) {
    await apiRequest('/api/auth/login', 'POST', { correo, contrasenia });
  }

  async googleLogin(credential: string): Promise<'pending' | 'ready'> {
    const result = await apiRequest<{ pending: true } | { user: Account }>(
      '/api/auth/google', 'POST', { credential },
    );
    return 'pending' in result ? 'pending' : 'ready';
  }

  async confirmGoogle(token: string, credential?: string) {
    await apiRequest('/api/auth/google/confirm', 'POST', {
      token, ...(credential ? { credential } : {}),
    });
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
