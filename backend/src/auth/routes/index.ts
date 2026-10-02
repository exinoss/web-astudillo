import { Elysia } from 'elysia';
import type { SQL } from 'bun';
import type { Config } from '../../config';
import type { Mailer } from '../../mailer';
import type { Security } from '../../security';
import type { Authorization } from '../types';
import { createGoogleAuth } from '../services/google';
import { createAttempts, createLimiter } from '../services/limits';
import { createLogin } from '../services/login';
import { createPasswords } from '../services/passwords';
import { createRegistration } from '../services/registration';
import { createSessions } from '../services/sessions';
import type { AuthContext } from './common';
import { googleRoutes } from './google';
import { passwordRoutes } from './passwords';
import { registrationRoutes } from './registration';
import { sessionRoutes } from './sessions';

export function authRoutes(sql: SQL, config: Config, mailer: Mailer,
  security: Security, authorization: Authorization) {
  const sessions = createSessions(sql, security);
  const attempts = createAttempts(sql);
  const context: AuthContext = {
    config, authorization, sessions,
    registration: createRegistration(sql, mailer, config),
    google: createGoogleAuth(sql, security, sessions),
    passwords: createPasswords(sql, security, attempts, mailer, config),
    login: createLogin(sql, sessions, attempts, mailer, config),
    limit: createLimiter(),
  };
  return new Elysia({ normalize: false })
    .use(registrationRoutes(context))
    .use(googleRoutes(context))
    .use(sessionRoutes(context))
    .use(passwordRoutes(context));
}
