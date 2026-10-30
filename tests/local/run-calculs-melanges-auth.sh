#!/usr/bin/env bash
# All changes below target uniquely named disposable containers and /tmp only.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TOOLS=${MATHAS_TEST_TOOLS:-/workspace/.mathas-tools}
LAB=$(mktemp -d /tmp/mathas-mixed-local.XXXXXX)
RUN_NAME=mathas-mixed-test-$$
LOCAL_PORT=${MATHAS_LOCAL_AUTH_PORT:-55431}
STATIC_PORT=${MATHAS_LOCAL_STATIC_PORT:-8876}
STATIC_PID=; RELAY_PID=
docker_local(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup(){
 test -z "$STATIC_PID" || kill "$STATIC_PID" 2>/dev/null || true
 test -z "$RELAY_PID" || kill "$RELAY_PID" 2>/dev/null || true
 for name in kong api results rest auth db; do docker_local rm -fv "$RUN_NAME-$name" >/dev/null 2>&1 || true; done
 docker_local network rm "$RUN_NAME" >/dev/null 2>&1 || true
 # Includes generated LOCAL credentials. Never preserve these in a published snapshot.
 rm -rf "$LAB"
}
trap cleanup EXIT
node "$ROOT/tests/local/calculs-melanges-prepare.mjs" "$ROOT" "$LAB" "http://127.0.0.1:$LOCAL_PORT"
printf "export {createClient} from '@supabase/supabase-js';\n" > "$TOOLS/mixed-sdk-entry.mjs"
"$TOOLS/node_modules/.bin/esbuild" "$TOOLS/mixed-sdk-entry.mjs" --bundle --platform=browser --format=esm --target=es2022 --outfile="$LAB/results/sdk.mjs" >/dev/null
cp "$LAB/results/sdk.mjs" "$LAB/api/sdk.mjs"
cp "$ROOT/tests/local/calculs-melanges-kong.yml" "$LAB/kong.yml"
chmod 755 "$LAB"
chmod 644 "$LAB/kong.yml"
docker_local info >/dev/null
# Official registry images, no build and no network access required inside containers.
for image in postgres:17-alpine supabase/gotrue:v2.186.0 postgrest/postgrest:v14.3 supabase/edge-runtime:v1.70.0 kong:2.8.1; do docker_local image inspect "$image" >/dev/null 2>&1 || docker_local pull "$image" >/dev/null; done
docker_local network create --internal "$RUN_NAME" >/dev/null
docker_local run -d --name "$RUN_NAME-db" --network "$RUN_NAME" --network-alias mathas-mixed-db --env-file "$LAB/postgres.env" postgres:17-alpine >/dev/null
for attempt in $(seq 1 30); do if docker_local exec "$RUN_NAME-db" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
docker_local exec -i "$RUN_NAME-db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon,authenticated,service_role TO postgres;
SQL
# The fixture's first two lines are a comment and the three role declarations above.
tail -n +3 "$ROOT/tests/postgres/calculs-melanges-fixture.sql" | docker_local exec -i "$RUN_NAME-db" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null
docker_local exec -i "$RUN_NAME-db" psql -U postgres -v ON_ERROR_STOP=1 < "$ROOT/supabase/release-candidates/calculs_melanges_locked_v1.sql" >/dev/null
docker_local exec -i "$RUN_NAME-db" psql -U postgres -v ON_ERROR_STOP=1 < "$ROOT/tests/postgres/calculs-melanges-auth-fixture.sql" >/dev/null
docker_local run -d --name "$RUN_NAME-auth" --network "$RUN_NAME" --network-alias mathas-mixed-auth --env-file "$LAB/auth.env" supabase/gotrue:v2.186.0 >/dev/null
docker_local run -d --name "$RUN_NAME-rest" --network "$RUN_NAME" --network-alias mathas-mixed-rest --env-file "$LAB/rest.env" postgrest/postgrest:v14.3 >/dev/null
for name in results api; do docker_local run -d --name "$RUN_NAME-$name" --network "$RUN_NAME" --network-alias "mathas-mixed-$name" --env-file "$LAB/$name/edge.env" -e NO_PROXY=mathas-mixed-kong,localhost,127.0.0.1 -e no_proxy=mathas-mixed-kong,localhost,127.0.0.1 --mount "type=bind,src=$LAB/$name,dst=/lab,readonly" supabase/edge-runtime:v1.70.0 start --main-service /lab >/dev/null; done
docker_local run -d --name "$RUN_NAME-kong" --network "$RUN_NAME" --network-alias mathas-mixed-kong -e KONG_DATABASE=off -e KONG_DECLARATIVE_CONFIG=/lab/kong.yml -e KONG_PROXY_LISTEN=0.0.0.0:8000 -e KONG_ADMIN_LISTEN=off --mount "type=bind,src=$LAB/kong.yml,dst=/lab/kong.yml,readonly" kong:2.8.1 >/dev/null
LOCAL_IP=$(docker_local inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$RUN_NAME-kong")
node "$ROOT/tests/local/calculs-melanges-proxy.mjs" "$LOCAL_IP" "$LOCAL_PORT" > "$LAB/relay.log" 2>&1 & RELAY_PID=$!
(cd "$ROOT" && python -m http.server "$STATIC_PORT" --bind 127.0.0.1) > "$LAB/static.log" 2>&1 & STATIC_PID=$!
for attempt in $(seq 1 45); do if curl --noproxy 127.0.0.1 --fail --silent "http://127.0.0.1:$LOCAL_PORT/auth/v1/health" >/dev/null; then break; fi; sleep 1; done
set -a
. "$LAB/local.env"
set +a
export SDK_BROWSER_PATH="$LAB/results/sdk.mjs"
export SUPABASE_SDK_MODULE="$TOOLS/node_modules/@supabase/supabase-js/dist/index.mjs"
export PLAYWRIGHT_MODULE="$TOOLS/node_modules/playwright/index.mjs"
export MATHAS_TEST_SITE="http://127.0.0.1:$STATIC_PORT"
export CHROMIUM_PATH=${CHROMIUM_PATH:-/usr/bin/chromium}
node "$ROOT/tests/calculs-melanges-auth-local.e2e.mjs"
