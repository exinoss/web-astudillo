import { HttpAuthRepository } from './http/http-auth-repository';
import type { AuthRepository } from './auth-repository';

export const authRepository: AuthRepository = new HttpAuthRepository();
