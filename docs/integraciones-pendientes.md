# Integraciones posteriores al acceso

El registro, el inicio de sesión, el perfil, el contenido, las alertas, las
sugerencias y el chat ya usan la API. Queda fijo en el código:

| Capacidad | Estado actual | Para conectarla |
| --- | --- | --- |
| Enlaces de ciudadanía | Lista fija en el código (el resto del contenido ya se gestiona desde el panel). | Solo si se quiere editar desde el panel. |
| Modelos 3D de las propuestas | En el código (`frontend/public/models/`), cruzados por slug. | Solo si se quiere subir modelos desde el panel. |

El backend conserva redirecciones GET para enlaces de correo antiguos:
`/api/auth/verify-email`, `/api/auth/password/reset` y
`/api/auth/login/confirm`. Redirigen a Astro sin consumir el token. Los
fallos de contraseña se limitan en PostgreSQL; los límites por cantidad de
registro, recuperación, Google, alertas, sugerencias y chat siguen en memoria y sirven para una instancia. Las pruebas
usan dobles de SMTP y Google; la entrega real se comprueba en el despliegue.
