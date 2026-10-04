import { HttpContentRepository } from "./http/http-content-repository";
import type { ContentRepository } from './content-repository';

// El contenido publicado viene del backend. Las pruebas compilan con `--mode test` y usan la
// misma semilla que PostgreSQL, para no depender de la base durante las pruebas aisladas.
export const contentRepository: ContentRepository = import.meta.env.MODE === "test"
  ? new (await import('./mock/mock-content-repository')).MockContentRepository()
  : new HttpContentRepository();
