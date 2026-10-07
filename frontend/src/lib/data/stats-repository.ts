export interface SiteStats { visitas: number; voces: number }

export interface StatsRepository {
  /** Null si no se pudieron leer: la portada se queda con las de la última compilación. */
  current(): Promise<SiteStats | null>;
  visit(): Promise<void>;
}
