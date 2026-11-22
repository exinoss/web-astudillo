import { Elysia } from 'elysia';
import type { SQL } from 'bun';
import { ipOf } from '../../auth/routes/common';
import type { Config } from '../../config';
import { createStats } from '../services/stats';

/** Rutas que cuentan las visitas y entregan las cifras del sitio. */
export function statsRoutes(sql: SQL, config: Config) {
  const stats = createStats(sql);
  return new Elysia({ prefix: '/api', normalize: false })
    .post('/visitas', async ({ request, server, set }) => {
      await stats.visit(ipOf(server, request, config.trustProxyIp));
      set.status = 204;
    })
    .get('/estadisticas', () => stats.current());
}
