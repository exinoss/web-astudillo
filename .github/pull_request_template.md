## Qué cambia

<!-- En una o dos frases, para quien usa el sitio o el panel. -->

## Tipo y versión

- [ ] `feat`: funcionalidad nueva (versión MENOR)
- [ ] `fix`: corrección (PARCHE)
- [ ] `refactor`, `docs`, `chore` o `ci`: interno (PARCHE o sin versión)
- [ ] Anotado en `CHANGELOG.md` (`[Unreleased]`, o la sección de la versión si este PR la publica)
- [ ] Si se tomó una decisión que debe conocer todo el equipo, está en `docs/decisiones.md`

## Verificación

- [ ] Backend: `bun run check` y `bun run test` con una base desechable
- [ ] Frontend: `bun run check`, `bun run build`, `bun run test:unit` y `bunx playwright test`
- [ ] Revisión visual en 320, 390, 768 y 1440 px y en los 8 modos de accesibilidad (si cambia algo visible)
- [ ] Probado en el servidor de desarrollo lo que depende del navegador
- [ ] Comentarios añadidos revisados contra la regla de `AGENTS.md`
- [ ] Migración probada en una base vacía y en una con el esquema anterior (si hay cambios de base)

## Aprobación

- [ ] No cambia nada visible, o el cliente aprobó las capturas (`design/propuestas/…`)
