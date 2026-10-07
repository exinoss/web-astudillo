import type { SQL } from 'bun';
import { callPg } from '../../db/call';

const SAME_VISIT_MS = 30 * 60_000;
const CACHE_MS = 60_000;
const MAX_TRACKED = 100_000;

export interface SiteStats { visitas: number; voces: number }

export function createStats(sql: SQL) {
  // La IP solo se recuerda en memoria, para no contar dos veces la misma visita; nunca se guarda.
  const recent = new Map<string, number>();
  let cache: { until: number; value: Promise<SiteStats> } | null = null;

  return {
    async visit(ip: string) {
      const now = Date.now();
      if ((recent.get(ip) ?? 0) > now) return;
      if (recent.size >= MAX_TRACKED) {
        for (const [key, until] of recent) if (until <= now) recent.delete(key);
        if (recent.size >= MAX_TRACKED) recent.clear();
      }
      recent.set(ip, now + SAME_VISIT_MS);
      await callPg(sql, 'visitAdd');
    },

    /** Se recalcula como mucho una vez por minuto: la portada la pide en cada visita. */
    current(): Promise<SiteStats> {
      if (cache && cache.until > Date.now()) return cache.value;
      const value = callPg<{ visitas: string; voces: string }>(sql, 'siteStats')
        .then(([row]) => ({ visitas: Number(row?.visitas ?? 0), voces: Number(row?.voces ?? 0) }));
      cache = { until: Date.now() + CACHE_MS, value };
      value.catch(() => { cache = null; });
      return value;
    },
  };
}
