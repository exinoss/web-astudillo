# La imagen de postgres lo ejecuta (con «source») solo al crear el volumen pgdata, en el primer arranque.
# Los privilegios de cada usuario los aplica la migración: backend/database/permisos.sql.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v migra="$DB_MIGRA_PASSWORD" -v app="$DB_APP_PASSWORD" -v pub="$DB_PUB_PASSWORD" <<'SQL'
CREATE ROLE astudillo_migra LOGIN PASSWORD :'migra';
CREATE ROLE astudillo_app LOGIN PASSWORD :'app';
CREATE ROLE astudillo_pub LOGIN PASSWORD :'pub';
CREATE DATABASE astudillo OWNER astudillo_migra;
REVOKE ALL ON DATABASE astudillo FROM PUBLIC;
GRANT CONNECT ON DATABASE astudillo TO astudillo_app, astudillo_pub;
SQL
