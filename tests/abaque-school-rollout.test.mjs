import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/release-candidates/20261115_abaque_school_all_presets.sql',import.meta.url),'utf8');
test('Abaque scolaire : cinq presets et classes explicitement gardés, aucun changement d’acquis',()=>{
 for(const v of ['Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO','observation','phase1','phase2','phase2b','2eco']) assert.ok(sql.includes("'"+v+"'"),v);
 assert.match(sql,/connect_abaque_classes \(class_id,enabled,pilot_only\)/);
 assert.match(sql,/SELECT id,true,false FROM public\.connect_classes/);
 assert.match(sql,/connect_hub_preset_entries \(preset_slug,app_key,section,display_order,visible,featured\)/);
 assert.match(sql,/'abaque-longueurs','outil',70,true,false/);
 assert.match(sql,/abaque_test_pilot_must_remain_enabled/);
 assert.match(sql,/COMMIT;/);
 assert.doesNotMatch(sql,/^\s*(DELETE|TRUNCATE|DROP|ALTER|UPDATE\s+public\.connect_(xp_|students|states|trophy_))/im);
});
