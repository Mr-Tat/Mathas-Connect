#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
RUN_NAME=mathas-mixed-sql-$$
LOG=$(mktemp /tmp/mathas-mixed-sql.XXXXXX)
docker_local(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup(){ docker_local rm -fv "$RUN_NAME" >/dev/null 2>&1 || true; rm -f "$LOG" "$LOG.a" "$LOG.b" "$LOG.policy-a" "$LOG.policy-b" "$LOG.before" "$LOG.installed" "$LOG.enabled" "$LOG.before.checked" "$LOG.installed.checked" "$LOG.query"; }
trap cleanup EXIT
docker_local run -d --name "$RUN_NAME" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
psql_local(){ docker_local exec -i "$RUN_NAME" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
# The Docker entrypoint's temporary init server accepts Unix sockets only.
# Waiting on TCP prevents racing its shutdown before the final server starts.
MIXED_POSTGRES_READY=false
for attempt in $(seq 1 60); do
 if docker_local exec "$RUN_NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then MIXED_POSTGRES_READY=true;break;fi
 sleep 1
done
if [ "$MIXED_POSTGRES_READY" != true ]; then
 printf 'ERROR: disposable PostgreSQL did not start its final TCP server within 60 seconds\n' >&2
 # Startup only: no identities, proofs or credentials have been inserted yet.
 docker_local logs --tail 40 "$RUN_NAME" >&2 || true
 exit 1
fi
psql_local < "$ROOT/tests/postgres/calculs-melanges-fixture.sql" >/dev/null
psql_local < "$ROOT/tests/postgres/calculs-melanges-auth-fixture.sql" >/dev/null
psql_local <<'SQL' >/dev/null
-- Fictitious metadata sentinels, not production schema changes. Their bodies
-- deliberately do nothing when the candidate later writes or creates objects.
CREATE FUNCTION public.test_mixed_metadata_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW;END $$;
CREATE TRIGGER test_mixed_metadata_row BEFORE UPDATE ON public.connect_states FOR EACH ROW EXECUTE FUNCTION public.test_mixed_metadata_row();
CREATE FUNCTION public.test_mixed_metadata_ddl() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RETURN;END $$;
CREATE EVENT TRIGGER test_mixed_metadata_ddl ON ddl_command_end EXECUTE FUNCTION public.test_mixed_metadata_ddl();
SQL
node "$ROOT/scripts/calculs-melanges-release.mjs" schema-query --output "$LOG.query" >/dev/null
schema_report(){ psql_local -X -q -t -A -f - < "$LOG.query"; }
schema_report > "$LOG.before"
node "$ROOT/scripts/calculs-melanges-release.mjs" check-report "$LOG.before" --stage before-install --output "$LOG.before.checked" >/dev/null
rm -f "$LOG.before.checked"
psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_locked_v1.sql" >/dev/null
schema_report > "$LOG.installed"
node "$ROOT/scripts/calculs-melanges-release.mjs" check-report "$LOG.installed" --stage installed-hidden --output "$LOG.installed.checked" >/dev/null
rm -f "$LOG.installed.checked"
psql_local < "$ROOT/tests/postgres/calculs-melanges-assertions.sql"
# One-time candidate must reject an already-installed/divergent namespace before any mutation.
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_locked_v1.sql" > "$LOG" 2>&1; then echo 'ERROR candidate unexpectedly reapplied';exit 1; fi
grep -Fq mixed_already_exists_review_required "$LOG"
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
grep -Fq revision_conflict "$LOG.a" "$LOG.b"
psql_local <<'SQL'
DO $$ BEGIN
 IF (SELECT revision FROM connect_states WHERE student_id='00000000-0000-4000-8000-000000000099')<>1
 OR (SELECT xp_credited FROM connect_xp_credits WHERE student_id='00000000-0000-4000-8000-000000000099')<>28
 THEN RAISE EXCEPTION 'concurrency_not_atomic';END IF;
END $$;
SQL
# Half/full proofs racing for the same revision cannot both claim points. The
# losing event retries its own UUID and earns only the remaining complement.
psql_local -c "INSERT INTO connect_students(id,display_name) VALUES('00000000-0000-4000-8000-000000000098','Fictif concurrence demi-XP')" >/dev/null
run_rate_racer(){ psql_local -c "SELECT connect_mixed_record_v1('00000000-0000-4000-8000-000000000098','$1',0,0,'classic',1,4,4,NULL,'$2','[\"add\",\"add\",\"add\",\"add\"]','[true,true,true,true]',false,false);"; }
run_rate_racer '00000000-0000-4000-8000-0000000000a1' '["add"]' > "$LOG.policy-a" 2>&1 & POLICY_A=$!
run_rate_racer '00000000-0000-4000-8000-0000000000b1' '["add","sub","mul"]' > "$LOG.policy-b" 2>&1 & POLICY_B=$!
POLICY_RC_A=0;POLICY_RC_B=0
wait "$POLICY_A" || POLICY_RC_A=$?
wait "$POLICY_B" || POLICY_RC_B=$?
if ! { { test "$POLICY_RC_A" -eq 0 && test "$POLICY_RC_B" -ne 0; } || { test "$POLICY_RC_B" -eq 0 && test "$POLICY_RC_A" -ne 0; }; }; then echo 'ERROR half/full concurrency outcome';exit 1;fi
grep -Fq revision_conflict "$LOG.policy-a" "$LOG.policy-b"
psql_local <<'SQL' >/dev/null
DO $$ DECLARE rev bigint;BEGIN
 SELECT revision INTO rev FROM connect_states WHERE student_id='00000000-0000-4000-8000-000000000098' AND app_key='melange-calculs-ecrits';
 PERFORM connect_mixed_record_v1('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-0000000000a1',rev,0,'classic',1,4,4,NULL,'["add"]','["add","add","add","add"]','[true,true,true,true]',false,false);
 SELECT revision INTO rev FROM connect_states WHERE student_id='00000000-0000-4000-8000-000000000098' AND app_key='melange-calculs-ecrits';
 PERFORM connect_mixed_record_v1('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-0000000000b1',rev,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","add","add","add"]','[true,true,true,true]',false,false);
 IF (SELECT xp_credited FROM connect_xp_credits WHERE student_id='00000000-0000-4000-8000-000000000098' AND app_key='melange-calculs-ecrits')<>28
 OR (SELECT revision FROM connect_states WHERE student_id='00000000-0000-4000-8000-000000000098' AND app_key='melange-calculs-ecrits')<>2
 OR (SELECT count(*) FROM connect_mixed_receipts WHERE student_id='00000000-0000-4000-8000-000000000098')<>2
 THEN RAISE EXCEPTION 'half_full_concurrency_overcredit';END IF;
END $$;
SQL
# Rejected pilot activation must roll back without enabling an app with drifted XP.
psql_local -c "UPDATE connect_xp_award_rules SET points=29 WHERE app_key='melange-calculs-ecrits' AND award_key='classic:4:perfect'" >/dev/null
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_enable_hidden.sql" > "$LOG" 2>&1; then echo 'ERROR drifted XP accepted';exit 1;fi
grep -Fq mixed_xp_rules_drift "$LOG"
psql_local -c "UPDATE connect_xp_award_rules SET points=28 WHERE app_key='melange-calculs-ecrits' AND award_key='classic:4:perfect'" >/dev/null
psql_local -c "UPDATE connect_xp_award_rules SET ruleset_version=1 WHERE app_key='melange-calculs-ecrits'" >/dev/null
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_enable_hidden.sql" > "$LOG" 2>&1; then echo 'ERROR drifted policy version accepted';exit 1;fi
grep -Fq mixed_xp_rules_drift "$LOG"
psql_local -c "UPDATE connect_xp_award_rules SET ruleset_version=2 WHERE app_key='melange-calculs-ecrits'" >/dev/null
psql_local -c "GRANT EXECUTE ON FUNCTION connect_mixed_xp_sync_v1(uuid,text,boolean) TO authenticated" >/dev/null
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_enable_hidden.sql" > "$LOG" 2>&1; then echo 'ERROR unsafe RPC accepted';exit 1;fi
grep -Fq mixed_unsafe_rpc "$LOG"
psql_local -c "REVOKE EXECUTE ON FUNCTION connect_mixed_xp_sync_v1(uuid,text,boolean) FROM authenticated" >/dev/null
psql_local -c "UPDATE connect_hub_preset_entries SET visible=true WHERE app_key='melange-calculs-ecrits' AND preset_slug='phase1'" >/dev/null
if psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_enable_hidden.sql" > "$LOG" 2>&1; then echo 'ERROR visible HUB accepted';exit 1;fi
grep -Fq mixed_hub_must_be_hidden "$LOG"
psql_local -c "UPDATE connect_hub_preset_entries SET visible=false WHERE app_key='melange-calculs-ecrits' AND preset_slug='phase1'" >/dev/null
psql_local <<'SQL' >/dev/null
DO $$ BEGIN
 IF (SELECT enabled FROM connect_apps WHERE app_key='melange-calculs-ecrits') THEN RAISE EXCEPTION 'failed_activation_enabled_app';END IF;
END $$;
SQL
psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_enable_hidden.sql" >/dev/null
schema_report > "$LOG.enabled"
node --input-type=module - "$ROOT" "$LOG.before" "$LOG.installed" "$LOG.enabled" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [root,...files]=process.argv.slice(2);
const {validateAudit}=await import(pathToFileURL(root+'/scripts/calculs-melanges-release.mjs'));
const [before,installed,enabled]=files.map(file=>JSON.parse(readFileSync(file,'utf8')));
assert.ok(before.triggers.some(t=>t.table==='connect_states'&&t.name==='test_mixed_metadata_row'&&/^[0-9a-f]{32}$/.test(t.functionDefinitionMd5)));
assert.ok(before.eventTriggers.some(t=>t.name==='test_mixed_metadata_ddl'&&/^[0-9a-f]{32}$/.test(t.functionDefinitionMd5)));
assert.deepEqual(before.triggers,installed.triggers);assert.deepEqual(before.eventTriggers,installed.eventTriggers);
assert.equal(validateAudit(enabled,'enabled-hidden').ok,true);
const shared=a=>(a.functions||[]).filter(f=>!f.name.startsWith('connect_mixed_'));
assert.deepEqual(shared(before),shared(installed));assert.deepEqual(shared(before),shared(enabled));
for(const mutate of [
 a=>a.tables.connect_states.columns.find(c=>c.name==='revision').type='integer',
 a=>a.tables.connect_states.uniqueKeys=[],
 a=>a.tables.connect_states.columns.push({name:'new_required',type:'text',nullable:false,default:null,generated:'',identity:''}),
 a=>a.functions.find(f=>f.name==='connect_mixed_record_v1').publicExecute=true,
 a=>a.tables.connect_mixed_receipts.rls=false,
 a=>a.tables.connect_mixed_receipts.uniqueKeys=[],
 a=>a.catalogue.presets[0].visible=true,
 a=>a.catalogue.rules[0].points++,
 a=>a.catalogue.rules[0].rulesetVersion=1,
]){const a=structuredClone(installed);mutate(a);assert.equal(validateAudit(a,'installed-hidden').ok,false);}
console.log('PASS read-only schema/trigger audit, drift detection, private grants, enabled app/four hidden HUBs and unchanged shared functions');
JS
psql_local < "$ROOT/supabase/release-candidates/calculs_melanges_disable_only.sql" >/dev/null
psql_local <<'SQL'
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM connect_apps WHERE app_key='melange-calculs-ecrits' AND enabled)
 OR NOT EXISTS(SELECT 1 FROM connect_xp_credits WHERE student_id='00000000-0000-4000-8000-000000000099' AND xp_credited=28)
 OR NOT EXISTS(SELECT 1 FROM connect_hub_preset_entries WHERE preset_slug='phase1' AND app_key='addition-ecrite-multiple' AND visible)
 THEN RAISE EXCEPTION 'disable_only_destructive';END IF;
END $$;
SQL
printf 'PASS one-time preflight, concurrent CAS, guarded hidden activation, shared RPC/Phase1 preserved, non-destructive disable-only\n'
