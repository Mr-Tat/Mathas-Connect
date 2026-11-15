import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20261116083000_abaque_record_awards_constraint.sql');
const awards=read('../supabase/migrations/20261107223500_abaque_204xp_5perpage_records.sql');

test('Abaque : droits PostgreSQL acceptent les trois nouveaux paliers record, sans effacer les anciens',()=>{
 assert.match(migration,/DROP CONSTRAINT connect_abaque_rights_milestone_check/);
 assert.match(migration,/ADD CONSTRAINT connect_abaque_rights_milestone_check CHECK/);
 for(const key of ['record:15','record:30','record:50']){
  assert.match(migration,new RegExp("'"+key+"'"));
  assert.match(awards,new RegExp("'"+key+"' THEN 24"));
 }
 for(const key of ['build:1','moves:2','five:perfect','record:5','record:10']){
  assert.match(migration,new RegExp("'"+key+"'"));
 }
 assert.match(migration,/abaque_rights_milestone_constraint_drift/);
 assert.doesNotMatch(migration,/DELETE FROM|TRUNCATE TABLE|DROP TABLE|UPDATE public\.connect_/);
});
