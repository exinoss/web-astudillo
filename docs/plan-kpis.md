# Plan — Sección de KPIs de campaña en el home

> Estado: **pendiente**. Planificado, no implementado. Se retoma después de la migración a Tailwind.

## Contexto

Agregar **KPIs de campaña visibles para el visitante** (cifras tipo "69 años de historia", "7 propuestas", "500 familias beneficiadas") como refuerzo de credibilidad antes de que el visitante llegue a la sección de propuestas. Hoy no existe ningún componente de estadísticas, badge ni contador en el sitio: es una sección nueva.

Decidido con el dueño: va como **franja propia entre "Conoce a Carlos" (`.about-section`) y "Propuestas" (`.proposals-section`)** en el home, siguiendo el mismo patrón de apilado que el resto de secciones (hero → citizen-strip → about → proposals → contact).

Los valores reales son datos de campaña que solo el dueño puede proveer; se implementa el mecanismo con 3-4 KPIs de ejemplo claramente marcados como reemplazables.

## Diseño

Replica el patrón repositorio ya usado por `Proposal` y `CitizenLink`; no introduce ninguna abstracción nueva.

1. **Tipo** en `frontend/src/lib/data/types.ts`:
   ```ts
   export interface Kpi {
     slug: string;
     value: string; // string, no number: admite "7", "69", "500+", "100%"
     label: string;
   }
   ```

2. **Interfaz**: añadir `getKpis(): Promise<Kpi[]>` a `ContentRepository` (`frontend/src/lib/data/content-repository.ts`).

3. **Semilla**: array `kpis` en `frontend/src/lib/data/mock/seed-data.ts`.

4. **Implementaciones**:
   - `mock/mock-content-repository.ts` → `async getKpis() { return kpis; }`
   - `http/http-content-repository.ts` → `GET /api/kpis`

5. **Página** `frontend/src/pages/index.astro`: `const kpis = await contentRepository.getKpis();` en el frontmatter, y nueva `<section class="stats-section" aria-label="Cifras de la campaña">` entre `.about-section` y `#propuestas`, con el mismo espaciado vertical que las secciones vecinas.

6. **Estilos**: grid que colapsa a 2 y luego 1 columna, replicando los breakpoints de `.proposal-grid`.

7. **`backend/README.md`**: entidad `Kpi` + fila `GET /api/kpis`, con el mismo formato que `CandidateProfile`/`ContactChannel`.

8. **`CHANGELOG.md`**: línea en `[Unreleased] > Added`.

## Verificación

- `bun run check` (0 errores) y `bun run build`.
- `bunx playwright test` → 7/7. La sección no agrega imágenes, así que no afecta al test que escanea `<img>`.
- Revisión visual en 390/760/1024/1440.
- No aplica diff de píxeles: es contenido nuevo, no un refactor de algo existente.

## Nota de secuencia

Este plan se escribió **antes** de la migración a Tailwind. Si se ejecuta después, los puntos 5 y 6 cambian: la sección se escribiría con utilidades de Tailwind en el markup y no haría falta un archivo `stats.css`.
