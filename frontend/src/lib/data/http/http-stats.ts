import type { SiteStats, StatsRepository } from '../stats-repository';

// Al compilar se pide al backend directamente; en el navegador, al mismo origen. No vale comprobar
// `process.env`: Vite lo cambia por `{}` en el código del navegador y se colaría la dirección local.
const API = import.meta.env.SSR ? process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000' : '';
const REINTENTOS = [0, 3_000, 10_000];

export const httpStatsRepository: StatsRepository = {
  current: () => fetch(`${API}/api/estadisticas`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() as Promise<SiteStats> : null)).catch(() => null),
  visit: async (visitante) => {
    for (const espera of REINTENTOS) {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      const res = await fetch('/api/visitas', {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitante }),
      }).catch(() => null);
      if (res && res.status < 500 && res.status !== 429) return;
    }
  },
};
