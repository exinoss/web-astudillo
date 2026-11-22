import type { SQL } from 'bun';
import { callPg } from '../../db/call';
import { sha256 } from '../../security';

const CACHE_MS = 60_000;
const NUEVAS_POR_IP = 120;
const HORA_MS = 60 * 60_000;
const MAX_IPS = 10_000;
const AUTOMATIZADO = /bot[/;)]|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|curl\/|wget|python-|go-http-client|node-fetch|axios/i;

export interface SiteStats { visitas: number; voces: number; personas: number }

/** Servicio que cuenta las visitas y calcula las cifras del sitio. */
export function createStats(sql: SQL) {
  // La IP solo se recuerda en memoria, para el tope de visitas nuevas; nunca se guarda.
  const nuevasPorIp = new Map<string, { count: number; until: number }>();
  let cache: { until: number; value: Promise<SiteStats> } | null = null;

  /** Indica si esa IP aún puede sumar visitas nuevas en la hora en curso. */
  function bajoElTope(ip: string, now: number) {
    const entry = nuevasPorIp.get(ip);
    return !entry || entry.until <= now || entry.count < NUEVAS_POR_IP;
  }

  /** Anota una visita nueva de esa IP. */
  function anotar(ip: string, now: number) {
    if (nuevasPorIp.size >= MAX_IPS) for (const [key, e] of nuevasPorIp) if (e.until <= now) nuevasPorIp.delete(key);
    const entry = nuevasPorIp.get(ip);
    nuevasPorIp.set(ip, !entry || entry.until <= now ? { count: 1, until: now + HORA_MS } : { ...entry, count: entry.count + 1 });
  }

  return {
    /** Registra la actividad de un navegador; suma una visita si es nuevo o volvió tras 30 minutos sin actividad. */
    async visit(visitante: string, ip: string, agente: string) {
      if (!agente || AUTOMATIZADO.test(agente)) return false;
      const now = Date.now();
      const [row] = await callPg<{ nueva: boolean }>(sql, 'visitRegister', [sha256(visitante), bajoElTope(ip, now)]);
      if (row?.nueva) anotar(ip, now);
      return !!row?.nueva;
    },

    /** Se recalcula como mucho una vez por minuto: la portada la pide en cada visita. */
    current(): Promise<SiteStats> {
      if (cache && cache.until > Date.now()) return cache.value;
      const value = callPg<{ visitas: string; voces: string; personas: string }>(sql, 'siteStats')
        .then(([row]) => ({ visitas: Number(row?.visitas ?? 0), voces: Number(row?.voces ?? 0), personas: Number(row?.personas ?? 0) }));
      cache = { until: Date.now() + CACHE_MS, value };
      value.catch(() => { cache = null; });
      return value;
    },
  };
}
