# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- Estructura inicial del repositorio (`frontend/`, `backend/`, `docs/`).
- Frontend (`frontend/`): migración completa del prototipo aprobado a Astro + Tailwind CSS v4 + DaisyUI, con paridad visual y funcional verificada (Playwright + comparación de capturas contra el prototipo).
- Capa de acceso a datos (`frontend/src/lib/data/`) con implementación local (mock) hoy y una implementación HTTP lista para conectarse al backend vía `PUBLIC_DATA_SOURCE`.
- `backend/README.md`: contrato de entidades y endpoints propuestos para cuando se implemente la API.
