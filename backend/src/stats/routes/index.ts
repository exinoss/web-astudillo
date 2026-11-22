import { Elysia, t } from 'elysia';
import type { SQL } from 'bun';
import { ipOf } from '../../auth/routes/common';
import type { Config } from '../../config';
import { strict } from '../../validation/esquemas';
import { VISITANTE } from '../../contracts/visitas';
import { createStats } from '../services/stats';

/** Rutas que cuentan las visitas y entregan las cifras del sitio. */
export function statsRoutes(sql: SQL, config: Config) {
  const stats = createStats(sql);
  return new Elysia({ prefix: '/api', normalize: false })
    .post('/visitas', async ({ body, request, server, set }) => {
      await stats.visit(body.visitante, ipOf(server, request, config.trustProxyIp), request.headers.get('user-agent') ?? '');
      set.status = 204;
    }, { body: t.Object({ visitante: t.String({ pattern: VISITANTE.source }) }, strict) })
    .get('/estadisticas', () => stats.current());
}
