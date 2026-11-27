import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankMultiClass} from '../projection-v2-model.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Approved account prioritizes requested active enrollment; fallback is stable',()=>{
 const api=read('supabase/functions/connect-api/index.ts');
 const code=api.slice(api.indexOf("case 'student-join-status'"),api.indexOf("case 'student-cancel-join'"));
 assert.match(code,/requestedEnrollment/);assert.match(code,/eq\('class_id',b.classId\)/);
 assert.match(code,/requestedEnrollment\|\|await one/);
 assert.match(read('app.js'),/existingProfileClass===cls\)location.href=hubLink/);
});
test('One pupil, two independent score boards',()=>{
 const classes=['B','ECO'].map((classId,i)=>({classId,name:classId,students:[{id:'same',name:'Fictif',scores:[{appKey:'addition-ecrite-simple',bestScore:10+i*30,todayScore:5+i}]}]}));
 for(const [i,c] of classes.entries()){
   const rows=rankMultiClass({classes,primaryClassId:c.classId,appKey:'addition-ecrite-simple'});
   assert.equal(rows.length,1);assert.equal(rows[0].score,10+i*30);
 }
});
test('Capture is bound to certified session, Abaque receipts to class, and removal only detaches membership',()=>{
 const sql=read('supabase/migrations/20261127090000_multiclass_identity_projection.sql');
 assert.match(sql,/session_id=sid::uuid AND student_id=NEW.student_id AND app_key=NEW.app_key/);
 assert.match(sql,/INSERT INTO public.connect_abaque_receipts\(student_id,event_id,reset_epoch,judgement,class_id\)/);
 assert.match(sql,/connect_abaque_receipt_class_matches_v1/);
 const detach=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.connect_detach_student_class_v1'));
 assert.match(detach,/SET left_at=now\(\) WHERE student_id=p_student AND class_id=p_class/);
 assert.doesNotMatch(detach,/DELETE FROM|UPDATE public.connect_students|UPDATE public.connect_devices/);
});
