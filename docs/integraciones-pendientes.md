# Integraciones posteriores al acceso

El registro, el inicio de sesión y el perfil ya usan la API. Las capacidades
siguientes usan datos o respuestas locales y requieren su propio backend en un
avance posterior:

| Capacidad | Estado actual | Para conectarla |
| --- | --- | --- |
| Propuestas y ciudadanía | Contenido local compilado por Astro. | Definir lectura, publicación y reconstrucción del sitio estático. |
| Sugerencias | La validación es local y la confirmación es simulada; no se guarda nada. | Definir contrato, validación y persistencia. |
| Alertas | Formulario y vista previa locales; la confirmación es simulada; no se guardan datos ni fotos. | Definir contrato, permisos de votante, límites y almacenamiento seguro de fotos. |
| Chat | Respuestas locales tipo preguntas frecuentes. | Definir fuente de respuestas, límites y contrato antes de crear el cliente HTTP. |

Cada capacidad tiene un repositorio en `frontend/src/lib/data/`. Su cliente
HTTP se añadirá cuando exista el contrato real. Las rutas HTTP especulativas
de contenido, sugerencias y alertas se retiraron.

El backend conserva redirecciones GET para enlaces de correo antiguos:
`/api/auth/verify-email`, `/api/auth/password/reset` y
`/api/auth/google/confirm`. Redirigen a Astro sin consumir el token. Los
límites de intentos del backend están en memoria y sirven para una instancia;
si se ejecutan varias, necesitarán almacenamiento compartido. Las pruebas
usan dobles de SMTP y Google; la entrega real se comprueba en el despliegue.
