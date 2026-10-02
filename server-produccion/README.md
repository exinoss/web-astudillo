# Despliegue en producción (VPS + Cloudflare)

Todo el sitio corre en un VPS (Hostinger) con Docker. Cloudflare va delante como proxy y gestiona el dominio.

```
Visitante ──HTTPS──▶ Cloudflare ──HTTPS (certificado de origen)──▶ nginx ─┬─ /            sitio compilado (volumen sitio)
                                                                          ├─ /medios/     fotos del panel (volumen medios)
                                                                          └─ /api/        backend ── PostgreSQL
                                                         publicador ──▶ compila el sitio en cada «Publicar» del panel
```

| Archivo | Para qué |
| --- | --- |
| `compose.yml` | Los cuatro contenedores: `db`, `backend`, `publicador` y `nginx` |
| `Dockerfile.publicador` | Imagen que compila el frontend (también la usa `server-local/`) |
| `nginx/default.conf` | Sitio, API, fotos, límites de subida y de peticiones al acceso |
| `nginx/cloudflare.conf` | Recupera la IP real del visitante (solo si la petición viene de Cloudflare) |
| `.env.example` | Variables que hay que completar en `.env` |

**¿Por qué nginx si ya está Cloudflare?** Cloudflare solo es el proxy y la caché que está delante. En el VPS hace falta alguien que sirva los archivos del sitio y las fotos, envíe `/api/` al backend, presente el certificado y limite el tamaño de las subidas.

## Primera instalación

1. **VPS**: Ubuntu 24.04 con Docker ([instrucciones oficiales](https://docs.docker.com/engine/install/ubuntu/)). Cortafuegos: solo SSH, 80 y 443.
   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
   ```
2. **Código**: `git clone <repositorio> astudillo && cd astudillo/server-produccion`.
3. **Variables**: `cp .env.example .env` y completarlo (dominio, clave de PostgreSQL, `JWT_SECRET`, Google y SMTP).
4. **Cloudflare**:
   - DNS: registro `A` del dominio (y de `www` si se usa) con la IP del VPS, con la nube **naranja** (proxy activado).
   - SSL/TLS → modo **Full (strict)**.
   - SSL/TLS → Origin Server → *Create certificate*. Guardar el certificado como `certificados/origen.pem` y la clave como `certificados/origen.key` (carpeta ignorada por Git). Dura 15 años, así que no hay que renovarlo.
   - Reglas de caché: que no se guarde en caché `/api/*`. nginx ya envía `no-store` en la API.
5. **Google Auth Platform**: añadir `https://DOMINIO` como origen autorizado del cliente web.
6. **Levantar**:
   ```bash
   docker compose up -d --build db
   docker compose run --rm backend bun run db:migrate
   docker compose up -d --build
   docker compose exec backend bun run admin:crear
   ```
   El sitio queda vacío hasta la primera publicación: entrar al panel con el admin maestro y pulsar «Publicar».
7. **Comprobar**: `https://DOMINIO/api/health` responde `{"ok":true}`.

## Actualizar a una versión nueva

```bash
cd astudillo && git pull
cd server-produccion
docker compose run --rm backend bun run db:migrate   # aplica migraciones nuevas, si las hay
docker compose up -d --build
```

Lo publicado desde el panel no se pierde: vive en la base y en el volumen `sitio`. Si cambió el código del sitio, basta con volver a pulsar «Publicar» para recompilarlo con el código nuevo.

## Respaldos

La base y las fotos están en volúmenes de Docker (`astudillo_pgdata`, `astudillo_medios`, `astudillo_privados`). Respaldo manual de la base:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > respaldo-$(date +%F).sql.gz
```

Conviene copiarlo fuera del VPS. Las fotos se respaldan copiando los volúmenes (`docker run --rm -v astudillo_medios:/v -v "$PWD":/r alpine tar czf /r/medios.tgz -C /v .`).

## Notas

- **IP real**: nginx solo cree la cabecera `CF-Connecting-IP` si la conexión llega desde un rango de Cloudflare (`nginx/cloudflare.conf`). Así el límite de intentos del backend cuenta por visitante. Si Cloudflare publica rangos nuevos en <https://www.cloudflare.com/ips/>, hay que añadirlos ahí.
- **Fotos de las alertas**: están en el volumen `privados`, que nginx no monta. Solo las entrega la API, a su autor y a quien revisa la participación.
- **CI/CD**: no hay ninguno configurado. Cuando se elija una herramienta, solo tiene que ejecutar por SSH los comandos de «Actualizar».
- **Probar en una PC con Windows**: usar `server-local/` (no necesita Cloudflare ni certificados).
