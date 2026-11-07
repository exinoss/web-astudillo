import { Elysia } from 'elysia';
import type { SQL } from 'bun';
import type { Authorization } from '../../auth/types';
import { access } from '../../content/routes';
import { createNotices } from '../services/notices';

/** Avisos de la campana del panel. */
export function noticesRoutes(sql: SQL, authorization: Authorization) {
  const notices = createNotices(sql, authorization);
  return new Elysia({ prefix: '/api/admin', normalize: false })
    .get('/avisos', ({ cookie }) => notices.list(access(cookie)));
}
