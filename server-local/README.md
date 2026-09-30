# Entorno local con Docker

Levanta todo el proyecto en otra PC para probarlo, sin instalar Bun ni PostgreSQL: todo corre en contenedores de Docker.

## Uso

1. Copia `backend/.env` y `frontend/.env` (o créalos desde sus `.env.example`).
2. Doble clic en **`server-local/iniciar.cmd`**.
3. La primera vez pide el correo, el nombre y la contraseña del **admin maestro**.
4. Se abre `http://localhost:4321` y la ventana muestra los registros de los servicios.

| Cómo sales | Qué pasa |
| --- | --- |
| **Ctrl+C** | Detiene todos los contenedores (los datos se conservan). |
| **Cerrar la ventana (X)** | Todo sigue encendido en Docker. |

Volver a abrirlo detecta lo que ya existe o ya está encendido y continúa: no reinstala nada, no vuelve a pedir el admin maestro y conserva los datos.

## Qué hace `iniciar.ps1`

1. **Comprueba los `.env`.** Si falta alguno, o un valor obligatorio, dice cuál y se detiene.
2. **Docker.** Si no está instalado, instala Docker Desktop con `winget` (Windows pide permiso de administrador) y, si hace falta, WSL 2, que puede requerir reiniciar la PC. Si está instalado pero apagado, lo arranca y espera.
3. **Imágenes.** Las construye; la primera vez tarda varios minutos y luego reutiliza la caché.
4. **PostgreSQL.** Lo levanta con el **usuario, la clave y el nombre de base de `DATABASE_URL`** de `backend/.env`. La primera vez crea esa base, y después aplica las migraciones, que crean las tablas. Dentro de Docker el servidor de la base es `db`, no `localhost`.
5. **Resto.** Levanta el backend, el sitio (servidor de desarrollo en el puerto 4321), el publicador y, si el correo del `.env` es local (Mailpit), un Mailpit propio. Su bandeja usa el primer puerto libre desde el 8025.
6. **Admin maestro.** Lo crea solo si todavía no existe.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `iniciar.cmd` | Abre `iniciar.ps1` con doble clic, sin cambiar la política de ejecución de PowerShell |
| `iniciar.ps1` | Los pasos de arriba |
| `compose.local.yml` | Los contenedores. Reutiliza `backend/Dockerfile` y `backend/Dockerfile.publicador` |

## Notas

- **Datos:** la base y las fotos subidas viven en los volúmenes `astudillo-local_pgdata` y `astudillo-local_medios`. Para empezar de cero: `docker compose -p astudillo-local down -v`.
- **Cambios en `DATABASE_URL`:** PostgreSQL solo crea el usuario y la base la primera vez. Si después cambias usuario, clave o nombre, hay que empezar de cero (comando de arriba).
- **Puerto 4321:** tiene que estar libre, porque es el origen que aceptan la API y Google. Cierra antes cualquier `bun run dev` del frontend.
- **No es el despliegue de producción:** ese está en `backend/docker-compose.yml`.
