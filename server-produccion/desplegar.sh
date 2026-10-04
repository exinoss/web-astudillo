#!/usr/bin/env bash
# Instala o actualiza la versión <sha> del repositorio clonado en /opt/astudillo/repo.
# Es el único comando que puede ejecutar la clave de GitHub Actions (command= en authorized_keys),
# que entrega el SHA en SSH_ORIGINAL_COMMAND. A mano: bash desplegar.sh <sha>.
# Repetirlo con el mismo SHA no cambia nada: la migración, la semilla y la reconstrucción son idempotentes.
set -euo pipefail

BASE=/opt/astudillo
COMPILACION_MAX_S=1200

falla() { echo "ERROR: $*" >&2; exit 1; }

esperar() {
  local limite=$1 descripcion=$2; shift 2
  local fin=$((SECONDS + limite))
  until "$@"; do
    ((SECONDS < fin)) || falla "Tiempo agotado esperando: $descripcion"
    sleep 5
  done
}

backend_sano() {
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q backend)" 2>/dev/null)" == healthy ]]
}

sitio_actualizado() {
  [[ "$(docker compose exec -T publicador cat /srv/sitio/version 2>/dev/null)" == "$VERSION" ]]
}

# Todo va dentro de main: el git checkout reescribe este archivo mientras bash todavía lo está leyendo.
main() {
  local version="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  [[ "$version" =~ ^[0-9a-f]{40}$ ]] || falla "Uso: desplegar.sh <sha de 40 caracteres>"

  exec 9>"$BASE/despliegue.lock"
  flock -w 1800 9 || falla "Otro despliegue sigue en curso"

  local libre_kb
  libre_kb=$(df --output=avail -k / | tail -1)
  ((libre_kb > 3 * 1024 * 1024)) || falla "Quedan menos de 3 GB libres en el disco"

  cd "$BASE/repo"
  git fetch --quiet origin
  git checkout --quiet --detach "$version"
  cd server-produccion
  [[ -f .env ]] || falla "Falta server-produccion/.env"
  export VERSION="$version"

  echo "Descargando imágenes de $VERSION…"
  docker compose pull --quiet

  if docker compose ps --status running --services | grep -qx db; then
    echo "Respaldando la base antes de migrar…"
    mkdir -p "$BASE/respaldos"
    docker compose exec -T db pg_dump -U postgres -Fc astudillo > "$BASE/respaldos/.parcial"
    mv "$BASE/respaldos/.parcial" "$BASE/respaldos/antes-$VERSION.dump"
    ls -1t "$BASE"/respaldos/antes-*.dump | tail -n +6 | xargs -r rm --
  fi

  # Una compilación a medias del publicador queda como fallida y se puede volver a publicar.
  docker compose stop publicador
  echo "Aplicando migraciones…"
  docker compose run --rm migrar
  docker compose up -d --remove-orphans

  # Desde aquí los comandos manuales de docker compose usan esta versión sin exportar VERSION.
  if grep -q '^VERSION=' .env; then sed -i "s/^VERSION=.*/VERSION=$VERSION/" .env
  else echo "VERSION=$VERSION" >> .env; fi

  esperar 180 "backend sano" backend_sano
  echo "Compilando el sitio…"
  esperar "$COMPILACION_MAX_S" "sitio compilado con $VERSION" sitio_actualizado
  curl -fsSk -o /dev/null https://127.0.0.1/api/health || falla "nginx no responde"

  echo "$(date -Is) $VERSION" >> "$BASE/versiones"
  docker image prune -af --filter "until=168h" > /dev/null
  echo "Versión $VERSION desplegada"
}

main "$@"
