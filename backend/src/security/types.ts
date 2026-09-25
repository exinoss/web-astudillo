import type { UserRow } from '../db/types';

export type Account = UserRow;

export interface GoogleIdentity {
  sub: string;
  email: string;
  verified: boolean;
  hostedDomain: string | null;
  name: string | null;
}

export interface Security {
  sign(user: Account): Promise<string>;
  verifyAccess(value: string | undefined): Promise<number | null>;
  verifyGoogle(credential: string, recent?: boolean): Promise<GoogleIdentity>;
}
