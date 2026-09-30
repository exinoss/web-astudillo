# Integraciones posteriores al acceso

El registro, el inicio de sesión y el perfil ya usan la API. Las capacidades
siguientes usan datos o respuestas locales y requieren su propio backend en un
avance posterior:

| Capacidad | Estado actual | Para conectarla |
| --- | --- | --- |
| Enlaces de ciudadanía | Lista fija en el código (el resto del contenido ya se gestiona desde el panel). | Solo si se quiere editar desde el panel. |
| Sugerencias | La validación es local y la confirmación es simulada; no se guarda nada. | Definir contrato, validación y persistencia. |
| Alertas | Formulario y vista previa locales; la confirmación es simulada; no se guardan datos ni fotos. | Definir contrato, permisos de votante, límites y almacenamiento seguro de fotos. |
| Chat | Respuestas locales tipo preguntas frecuentes. | Definir fuente de respuestas, límites y contrato antes de crear el cliente HTTP. |

Cada capacidad tiene un repositorio en `frontend/src/lib/data/`. Su cliente
HTTP se añadirá cuando exista el contrato real. Las rutas HTTP especulativas
de contenido, sugerencias y alertas se retiraron.

El backend conserva redirecciones GET para enlaces de correo antiguos:
`/api/auth/verify-email`, `/api/auth/password/reset` y
`/api/auth/login/confirm`. Redirigen a Astro sin consumir el token. Los
fallos de contraseña se limitan en PostgreSQL; los límites por cantidad de
registro, recuperación y Google siguen en memoria y sirven para una instancia. Las pruebas
usan dobles de SMTP y Google; la entrega real se comprueba en el despliegue.
