# Despliegue en producción (VPS + Cloudflare)

VPS de Hostinger con Docker Compose, Cloudflare como DNS y proxy, y despliegue desde GitHub Actions. El dominio sigue registrado en Hostinger. Los pasos completos, desde cero, están en [la guía de despliegue](../docs/guia-despliegue-hostinger.md).

```
Visitante ──HTTPS──▶ Cloudflare ──HTTPS (certificado de origen)──▶ nginx ─┬─ /            sitio compilado (volumen sitio)
                                                                          ├─ /medios/     fotos del panel (volumen medios)
                                                                          └─ /api/        backend ── PostgreSQL
                                                         publicador ──▶ compila el sitio en cada «Publicar» y con cada versión nueva
GitHub Actions ──pruebas──▶ imágenes en GHCR (etiqueta = SHA) ──SSH por Tailscale──▶ desplegar.sh <sha>
```

| Archivo | Para qué |
| --- | --- |
| `compose.yml` | `db`, `backend`, `publicador`, `nginx` y `migrar` (solo se lanza al desplegar) |
| `desplegar.sh` | Instala o actualiza una versión: imágenes, respaldo, migración, arranque y comprobaciones |
| `postgres/roles.sh` | Crea los usuarios de PostgreSQL y la base en el primer arranque |
| `Dockerfile.publicador` | Imagen que compila el frontend (también la usa `server-local/`) |
| `nginx/default.conf` | Sitio, API, fotos, límites de subida y de peticiones al acceso |
| `nginx/cabeceras.inc` | Cabeceras de seguridad comunes |
| `nginx/cloudflare.conf` | Recupera la IP real del visitante (solo si la petición viene de Cloudflare) |
| `.env.example` | Variables que hay que completar en `.env` |

**¿Por qué nginx si ya está Cloudflare?** Cloudflare solo es el proxy y la caché que está delante. En el VPS hace falta alguien que sirva los archivos del sitio y las fotos, envíe `/api/` al backend, presente el certificado y limite el tamaño de las subidas.

## PostgreSQL

Corre en el contenedor `db` (imagen oficial `postgres:17-alpine`), con los datos en el volumen `astudillo_pgdata` y sin ningún puerto publicado: solo lo alcanzan los demás contenedores. La autenticación es por contraseña (SCRAM).

| Usuario | Lo usa | Puede |
| --- | --- | --- |
| `postgres` | Nadie de forma automática; mantenimiento y `desplegar.sh` para el respaldo | Todo (superusuario) |
| `astudillo_migra` | `migrar` | Dueño de la base `astudillo`: crea y cambia tablas y funciones |
| `astudillo_app` | `backend` | Leer y escribir datos y ejecutar funciones; no puede cambiar el esquema |
| `astudillo_pub` | `publicador` | Solo tomar y cerrar publicaciones |

Cada uno tiene su clave en `.env`. `postgres/roles.sh` las aplica solo la primera vez que arranca la base (volumen vacío); los privilegios los vuelve a aplicar cada migración (`backend/database/permisos.sql`).

Cambiar una clave más adelante:

```bash
cd /opt/astudillo/repo/server-produccion
docker compose exec -T db psql -U postgres -c "ALTER ROLE astudillo_app PASSWORD 'clave-nueva'"
# Poner la misma clave en .env (DB_APP_PASSWORD) y recrear quien la usa:
docker compose up -d backend
```

## Desplegar y volver atrás

Lo hace GitHub Actions con cada push a `main`. A mano, como el usuario `despliegue`:

```bash
bash /opt/astudillo/repo/server-produccion/desplegar.sh <sha-completo>
```

Para volver a una versión anterior: *Actions* → *Pruebas y despliegue* → *Run workflow* con el SHA (los instalados están en `/opt/astudillo/versiones`). Solo si esa versión es compatible con la base ya migrada; nunca se revierte la base de forma automática.

`desplegar.sh` guarda un respaldo de la base antes de cada migración en `/opt/astudillo/respaldos/` (los 5 últimos). Al arrancar una versión nueva, el publicador recompila lo último publicado con el código nuevo; los borradores no se publican.

No usar nunca `docker compose down -v`: borra la base y las fotos.

## Respaldos manuales

```bash
docker compose exec -T db pg_dump -U postgres -Fc astudillo > respaldo-$(date +%F).dump
docker run --rm -v astudillo_medios:/v -v "$PWD":/r alpine tar czf /r/medios.tgz -C /v .
docker run --rm -v astudillo_privados:/v -v "$PWD":/r alpine tar czf /r/privados.tgz -C /v .
```

Copiarlos fuera del VPS. El respaldo automático externo está en la fase 9 de la guía.

## Notas

- **IP real**: nginx solo cree la cabecera `CF-Connecting-IP` si la conexión llega desde un rango de Cloudflare (`nginx/cloudflare.conf`). Así el límite de intentos del backend cuenta por visitante. Si Cloudflare publica rangos nuevos en <https://www.cloudflare.com/ips/>, hay que añadirlos ahí y en el cortafuegos de Hostinger.
- **Fotos de las alertas**: están en el volumen `privados`, que nginx no monta. Solo las entrega la API, a su autor y a quien revisa la participación.
- **Probar en una PC con Windows**: usar `server-local/` (no necesita Cloudflare ni certificados).
