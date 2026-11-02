#!/usr/bin/env bash
# Disposable LOCAL database/Auth/Edge only. Never accepts hosted credentials.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
source "$ROOT/tests/local/abaque-images.sh"
TOOLS=${MATHAS_TEST_TOOLS:-/workspace/.cloud-tools}
LAB=$(mktemp -d /tmp/mathas-abaque-local.XXXXXX)
RUN_NAME=mathas-abaque-test-$$-$RANDOM
DATABASE_PORT=${ABAQUE_LOCAL_DATABASE_PORT:-55432}
API_PORT=${ABAQUE_LOCAL_API_PORT:-55433}
STATIC_PORT=${ABAQUE_LOCAL_STATIC_PORT:-8877}
DATABASE_RELAY=; API_RELAY=; STATIC_PID=
docker_local(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup(){
 test_status=$?
 if [ "$test_status" -ne 0 ]; then
  python3 "$ROOT/tests/local/abaque-diagnostics.py" "$RUN_NAME" || true
 fi
 for pid in "$DATABASE_RELAY" "$API_RELAY" "$STATIC_PID"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done
 for name in gateway edge rest auth db; do docker_local rm -fv "$RUN_NAME-$name" >/dev/null 2>&1 || true; done
 docker_local network rm "$RUN_NAME" >/dev/null 2>&1 || true
 rm -rf "$LAB"
}
trap cleanup EXIT
node "$ROOT/tests/local/abaque-prepare.mjs" "$ROOT" "$LAB" "$TOOLS" "$DATABASE_PORT" "$API_PORT" "$STATIC_PORT"
docker_local info >/dev/null
for image in "$ABAQUE_POSTGRES_IMAGE"; do docker_local image inspect "$image" >/dev/null 2>&1 || docker_local pull "$image" >/dev/null; done
docker_local network create --internal "$RUN_NAME" >/dev/null
docker_local run -d --name "$RUN_NAME-db" --network "$RUN_NAME" --network-alias abaque-db --env-file "$LAB/postgres.env" "$ABAQUE_POSTGRES_IMAGE" >/dev/null
ready=false
for attempt in $(seq 1 45); do
 if docker_local exec "$RUN_NAME-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true;break;fi
 sleep 1
done
if ! "$ready"; then printf 'Disposable database failed to start\n' >&2;exit 1;fi
for fixture in "$ROOT/tests/postgres/calculs-melanges-fixture.sql" "$ROOT/tests/postgres/calculs-melanges-auth-fixture.sql" "$ROOT/supabase/release-candidates/20261031_permanent_trophies_hub_v1.sql" "$ROOT/supabase/release-candidates/connect_lab_hub_visibility_v1.sql"; do
 docker_local exec -i "$RUN_NAME-db" psql -U postgres -d abaque_test -v ON_ERROR_STOP=1 < "$fixture" >/dev/null
done
docker_local exec -i "$RUN_NAME-db" psql -U postgres -d abaque_test -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA auth;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[],created_by text,idempotency_key text UNIQUE,rollback text[]);
ALTER ROLE service_role BYPASSRLS;
GRANT anon,authenticated,service_role TO postgres;
INSERT INTO public.connect_classes(id,name) VALUES('4bf3400d-a315-4ea4-a2f3-afaca24dc9b9','Classe démo - TEST');
SQL
docker_local exec -i "$RUN_NAME-db" psql -U postgres -d abaque_test -v ON_ERROR_STOP=1 --tuples-only --no-align < "$ROOT/supabase/release-candidates/abaque_schema_readonly.sql" > "$LAB/schema-audit.json"
node "$ROOT/scripts/abaque-release.mjs" prepare-install "$LAB/schema-audit.json" "$LAB/install.sql"
docker_local exec -i "$RUN_NAME-db" psql -U postgres -d abaque_test -v ON_ERROR_STOP=1 < "$LAB/install.sql" >/dev/null
DATABASE_IP=$(docker_local inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$RUN_NAME-db")
node "$ROOT/tests/local/abaque-tcp-relay.mjs" "$DATABASE_IP" 5432 "$DATABASE_PORT" > "$LAB/database-relay.log" 2>&1 & DATABASE_RELAY=$!
export ABAQUE_LOCAL_MANIFEST="$LAB/local.json"
node --test "$ROOT/tests/abaque-postgres.runtime.mjs"
if [ "${1:-}" = '--postgres-only' ]; then exit 0;fi
for image in "$ABAQUE_AUTH_IMAGE" "$ABAQUE_REST_IMAGE" "$ABAQUE_EDGE_IMAGE" "$ABAQUE_GATEWAY_IMAGE"; do
 docker_local image inspect "$image" >/dev/null 2>&1 || docker_local pull "$image" >/dev/null
done
for name in auth rest; do
 image=$ABAQUE_AUTH_IMAGE; test "$name" = auth || image=$ABAQUE_REST_IMAGE
 docker_local run -d --name "$RUN_NAME-$name" --network "$RUN_NAME" --network-alias "abaque-$name" --env-file "$LAB/$name.env" "$image" >/dev/null
done
docker_local run -d --name "$RUN_NAME-edge" --network "$RUN_NAME" --network-alias abaque-edge --env-file "$LAB/edge.env" -e NO_PROXY=abaque-gateway,localhost,127.0.0.1 -e no_proxy=abaque-gateway,localhost,127.0.0.1 --mount "type=bind,src=$LAB/edge,dst=/lab,readonly" "$ABAQUE_EDGE_IMAGE" start --main-service /lab >/dev/null
docker_local run -d --name "$RUN_NAME-gateway" --network "$RUN_NAME" --network-alias abaque-gateway -e KONG_DATABASE=off -e KONG_DECLARATIVE_CONFIG=/lab/kong.yml -e KONG_PROXY_LISTEN=0.0.0.0:8000 -e KONG_ADMIN_LISTEN=off --mount "type=bind,src=$LAB/kong.yml,dst=/lab/kong.yml,readonly" "$ABAQUE_GATEWAY_IMAGE" >/dev/null
GATEWAY_IP=$(docker_local inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$RUN_NAME-gateway")
node "$ROOT/tests/local/abaque-tcp-relay.mjs" "$GATEWAY_IP" 8000 "$API_PORT" > "$LAB/api-relay.log" 2>&1 & API_RELAY=$!
python3 -m http.server "$STATIC_PORT" --bind 127.0.0.1 --directory "$ROOT" > "$LAB/static.log" 2>&1 & STATIC_PID=$!
ready=false
for attempt in $(seq 1 45); do
 if curl --noproxy 127.0.0.1 --max-time 2 --fail --silent "http://127.0.0.1:$API_PORT/auth/v1/health" >/dev/null; then ready=true;break;fi
 sleep 1
done
if ! "$ready"; then printf 'Disposable Auth failed to become ready\n' >&2;exit 1;fi
node --test "$ROOT/tests/abaque-auth-local.e2e.mjs"
