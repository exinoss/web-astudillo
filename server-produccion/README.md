# Despliegue en producción

Docker Compose en un VPS, con Cloudflare delante como DNS y proxy. Las versiones se prueban y se construyen en GitHub Actions y se instalan con `desplegar.sh`. La operación del servidor se documenta aparte, fuera del repositorio.

```
Visitante ──HTTPS──▶ Cloudflare ──HTTPS (certificado de origen)──▶ nginx ─┬─ /            sitio compilado
                                                                          ├─ /medios/     fotos del panel
                                                                          └─ /api/        backend ── PostgreSQL
                                                         publicador ──▶ compila el sitio en cada «Publicar» y con cada versión nueva
```

| Archivo | Para qué |
| --- | --- |
| `compose.yml` | `db`, `backend`, `publicador`, `nginx` y `migrar` (solo se lanza al desplegar) |
| `desplegar.sh` | Instala o actualiza una versión: imágenes, respaldo, migración, arranque y comprobaciones |
| `postgres/roles.sh` | Prepara la base en el primer arranque |
| `Dockerfile.publicador` | Imagen que compila el frontend (también la usa `server-local/`) |
| `nginx/default.conf` | Sitio, vista previa del borrador, API, fotos, límites de subida y de peticiones al acceso |
| `nginx/cabeceras.inc` | Cabeceras de seguridad comunes |
| `nginx/cloudflare.conf` | Recupera la IP real del visitante (solo si la petición viene de Cloudflare) |
| `.env.example` | Variables que hay que completar en `.env` (nunca se sube a Git) |
| `monitoreo/compose.yml` | Métricas del servidor y de los contenedores (Beszel), aparte de la app; solo accesible desde la red privada |

**¿Por qué nginx si ya está Cloudflare?** Cloudflare solo es el proxy y la caché que está delante. En el servidor hace falta alguien que sirva los archivos del sitio y las fotos, envíe `/api/` al backend, presente el certificado y limite el tamaño de las subidas.

## Notas

- **Cada servicio usa su propia credencial de base de datos** con los permisos mínimos (`backend/database/permisos.sql`). La base no es accesible desde Internet.
- **Al arrancar una versión nueva**, el publicador recompila lo último publicado con el código nuevo; los borradores no se publican.
- **Pestañas abiertas al publicar**: los recursos públicos con hash de `/_astro/` se conservan durante siete días desde que dejan de usarse. La fecha queda en `.recursos-retenidos.json` dentro de la salida compilada, y la limpieza se hace en cada publicación; las páginas y los recursos del borrador se reemplazan sin retención.
- **Vista previa del borrador**: el publicador la compila en `/srv/sitio/dist-vista-previa` (sus archivos en `/_astro-vista-previa/`, separados de los del sitio). Con la cookie `vista_previa`, nginx sirve las páginas desde esa carpeta (salvo `/cuenta/`, donde está el panel) y valida cada petición con el backend (`auth_request`); un pase inválido o caducado vuelve al panel. Quien no tiene la cookie no hace ninguna petición de más. Estas respuestas llevan `Cache-Control: private, no-store` y `X-Robots-Tag: noindex`.
- **Nunca usar `docker compose down -v`**: borra la base y las fotos.
- **IP real**: nginx solo cree la cabecera `CF-Connecting-IP` si la conexión llega desde un rango de Cloudflare (`nginx/cloudflare.conf`). Si Cloudflare publica rangos nuevos en <https://www.cloudflare.com/ips/>, hay que añadirlos ahí.
- **Fotos de las alertas**: están en un volumen que nginx no monta. Solo las entrega la API, a su autor y a quien revisa la participación.
- **Probar en una PC con Windows**: usar `server-local/` (no necesita Cloudflare ni certificados).
