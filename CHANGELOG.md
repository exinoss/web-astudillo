# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- Estructura inicial del repositorio (`frontend/`, `backend/`, `docs/`).
- Frontend (`frontend/`): migración completa del prototipo aprobado a Astro + Tailwind CSS v4, con paridad visual y funcional verificada (Playwright + comparación de capturas contra el prototipo).
- Capa de acceso a datos (`frontend/src/lib/data/`) con implementación local (mock) hoy y una implementación HTTP lista para conectarse al backend vía `PUBLIC_DATA_SOURCE`.
- `backend/README.md`: contrato de entidades y endpoints propuestos para cuando se implemente la API.
- Efecto de cortina de cristal en el carrusel de retrato: un panel translúcido sube y baja sobre la tarjeta, delimitado por una línea luminosa.
- Modelo 3D interactivo en la página de «Tecnologías emergentes» (`<model-viewer>`): se gira y se acerca, se carga solo al entrar en pantalla y respeta «Reducir movimiento» y el ahorro de datos del navegador. `bun run modelos` optimiza los `.glb` de `frontend/modelos-fuente/` hacia `frontend/public/models/`: el primero pasa de 2,69 MB a 282 KB (79 KB servido con gzip).

### Changed

- Los estilos se reparten en 14 archivos por componente (`base`, `header`, `hero`, `about`, `contact`…) en vez de un único `global.css` de 2439 líneas; `global.css` queda como punto de entrada con los `@import` y el `@theme`.
- Las cadenas de utilidades que se repetían en el markup se consolidan en las clases `.eyebrow`, `.button` y `.button-light`.

### Removed

- Dependencia `daisyui`: no se usaba ninguna de sus clases ni su mecanismo de temas; sus tokens de color pasaron a `@theme`.
