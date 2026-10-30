#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
RUN_NAME=mathas-mixed-sql-$$
LOG=$(mktemp /tmp/mathas-mixed-sql.XXXXXX)
docker_local(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup(){ docker_local rm -fv "$RUN_NAME" >/dev/null 2>&1 || true; rm -f "$LOG" "$LOG.a" "$LOG.b"; }
trap cleanup EXIT
docker_local run -d --name "$RUN_NAME" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
psql_local(){ docker_local exec -i "$RUN_NAME" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
for attempt in $(seq 1 30); do if docker_local exec "$RUN_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
psql_local < "$ROOT/tests/postgres/calculs-melanges-fixture.sql" >/dev/null
psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_locked_v1.sql" >/dev/null
psql_local < "$ROOT/tests/postgres/calculs-melanges-assertions.sql"
# One-time candidate must reject an already-installed/divergent namespace before any mutation.
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_locked_v1.sql" > "$LOG" 2>&1; then echo 'ERROR candidate unexpectedly reapplied';exit 1; fi
rg -q mixed_already_exists_review_required "$LOG"
# Two distinct events race against revision 0: exactly one commit, one CAS failure.
psql_local <<'SQL' >/dev/null
INSERT INTO connect_students(id,display_name) VALUES('00000000-0000-4000-8000-000000000099','Fictif concurrence');
SQL
run_racer(){ psql_local -c "SELECT connect_mixed_record_v1('00000000-0000-4000-8000-000000000099',gen_random_uuid(),0,0,'classic',1,4,4,NULL,'[\"add\",\"sub\",\"mul\"]','[\"add\",\"sub\",\"add\",\"sub\"]','[true,true,true,true]',false,false);"; }
run_racer > "$LOG.a" 2>&1 & PID_A=$!
run_racer > "$LOG.b" 2>&1 & PID_B=$!
RC_A=0; RC_B=0
wait "$PID_A" || RC_A=$?
wait "$PID_B" || RC_B=$?
if ! { { test "$RC_A" -eq 0 && test "$RC_B" -ne 0; } || { test "$RC_B" -eq 0 && test "$RC_A" -ne 0; }; }; then echo 'ERROR concurrency outcome';exit 1;fi
rg -q revision_conflict "$LOG.a" "$LOG.b"
psql_local <<'SQL'
DO $$ BEGIN
 IF (SELECT revision FROM connect_states WHERE student_id='00000000-0000-4000-8000-000000000099')<>1
 OR (SELECT xp_credited FROM connect_xp_credits WHERE student_id='00000000-0000-4000-8000-000000000099')<>28
 THEN RAISE EXCEPTION 'concurrency_not_atomic';END IF;
END $$;
SQL
psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_disable_only.sql" >/dev/null
psql_local <<'SQL'
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM connect_apps WHERE app_key='melange-calculs-ecrits' AND enabled)
 OR NOT EXISTS(SELECT 1 FROM connect_xp_credits WHERE student_id='00000000-0000-4000-8000-000000000099' AND xp_credited=28)
 OR NOT EXISTS(SELECT 1 FROM connect_hub_preset_entries WHERE preset_slug='phase1' AND app_key='addition-ecrite-multiple' AND visible)
 THEN RAISE EXCEPTION 'disable_only_destructive';END IF;
END $$;
SQL
printf 'PASS one-time preflight, concurrent CAS, shared RPC/Phase1 preserved, non-destructive disable-only\n'
