import type { InferSelectModel } from 'drizzle-orm';
import type { tbRegistrosPendientes, tbTokenAutenticacion, tbUsuarios } from './schema';

export type UserRow = InferSelectModel<typeof tbUsuarios, { dbColumnNames: true }>;
export type AuthTokenRow = InferSelectModel<typeof tbTokenAutenticacion, { dbColumnNames: true }>;
export type PendingRegistrationRow = AuthTokenRow
  & InferSelectModel<typeof tbRegistrosPendientes, { dbColumnNames: true }>;
export type PasswordUserRow = UserRow & { contrasenia_hash: string };
