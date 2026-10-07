import type { StatsRepository } from './stats-repository';
import { httpStatsRepository } from './http/http-stats';

// En las pruebas aisladas (`--mode test`) no hay backend: cifras fijas y las visitas no se envían.
export const statsRepository: StatsRepository = import.meta.env.MODE === 'test'
  ? { current: async () => ({ visitas: 12480, voces: 356 }), visit: async () => {} }
  : httpStatsRepository;
