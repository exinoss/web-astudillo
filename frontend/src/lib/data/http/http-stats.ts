import type { SiteStats, StatsRepository } from '../stats-repository';

// Al compilar se pide al backend directamente; en el navegador, al mismo origen.
const API = globalThis.process?.env ? globalThis.process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000' : '';

export const httpStatsRepository: StatsRepository = {
  current: () => fetch(`${API}/api/estadisticas`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() as Promise<SiteStats> : null), () => null),
  visit: () => fetch('/api/visitas', { method: 'POST', credentials: 'same-origin', keepalive: true }).then(() => {}, () => {}),
};
