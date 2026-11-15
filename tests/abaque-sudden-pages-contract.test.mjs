import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration=read('../supabase/migrations/20261116081500_abaque_sudden_trophies_by_pages.sql');
const original=read('../supabase/migrations/20261107223500_abaque_204xp_5perpage_records.sql');

test('Abaque : les coupes Mort subite suivent 3, 5 et 8 pages de 5 conversions, pas 3, 5 et 8 conversions',()=>{
 assert.match(original,/\(VALUES \(3,'abaque:sudden-bronze'\),\(5,'abaque:sudden-silver'\),\(8,'abaque:sudden-gold'\)\) AS cups\(pages,trophy_key\)/);
 assert.match(migration,/\(VALUES \(15,''abaque:sudden-bronze''\),\(25,''abaque:sudden-silver''\),\(40,''abaque:sudden-gold''\)\) AS cups\(conversions,trophy_key\)/);
 assert.match(migration,/EXECUTE replace\(definition,old_thresholds,new_thresholds\)/);
 assert.match(migration,/abaque_sudden_trophy_contract_drift/);
 assert.doesNotMatch(migration,/DELETE FROM|TRUNCATE TABLE|UPDATE public\.connect_trophy_achievements/);
 assert.match(original,/first_good>=15 THEN PERFORM public\.connect_abaque_award_v1\(pupil,'record:15',24\)/);
 assert.match(original,/first_good>=30 THEN PERFORM public\.connect_abaque_award_v1\(pupil,'record:30',24\)/);
 assert.match(original,/first_good>=50 THEN PERFORM public\.connect_abaque_award_v1\(pupil,'record:50',24\)/);
});
