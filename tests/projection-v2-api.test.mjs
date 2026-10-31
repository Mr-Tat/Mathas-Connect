import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../supabase/functions/connect-projection-v2/index.ts',import.meta.url),'utf8');
test('projection V2 API : JWT Supabase + vraie permission du professeur pour chaque classe',()=>{
 assert.match(src,/client\.auth\.getUser\(token\)/);
 assert.match(src,/user\.is_anonymous/);
 assert.match(src,/connect_teachers/);
 assert.match(src,/connect_class_permissions/);
 assert.match(src,/\.eq\('teacher_id',teacherId\)\.eq\('can_manage',true\)/);
 assert.match(src,/classIds=distinct\(\[b\.classId,\.\.\.comparisons\]\)/);
 assert.match(src,/if\(!await ownClasses\(user\.id,classIds\)\)/);
});
test('projection V2 API : remise à zéro seulement (classe,jeu), mot de passe Auth revalidé',()=>{
 assert.match(src,/b\.action==='teacher-reset-score'/);
 assert.match(src,/ephemeral\.auth\.signInWithPassword\(\{email,password\}\)/);
 assert.match(src,/data\.user\?\.id===teacherId/);
 assert.match(src,/if\(!await checkPassword\(user\.email,b\.password,user\.id\)\)/);
 assert.match(src,/connect_projection_reset_score_v1/);
 assert.match(src,/p_class:b\.classId,p_app:b\.appKey,p_teacher:user\.id/);
 assert.doesNotMatch(src,/connect_parcours_restart|teacher-parcours-restart|\.delete\(|reset_epoch\s*=/);
 assert.match(src,/Never log request payload/);
});
test('projection V2 API : confidentialité des noms et pourcentages non inventés',()=>{
 assert.match(src,/projection_opt_in===true\|\|\(showTeacher&&id===teacherId\)/);
 assert.match(src,/showTeacher=b\.showTeacher===true/);
 assert.match(src,/percentages:null,percentageStatus:'exercise_telemetry_not_yet_available'/);
 assert.match(src,/cache-control':'no-store/);
});
test('projection V2 API : réglages isolés à la classe et validés',()=>{
 assert.match(src,/b\.action==='teacher-save-options'/);
 assert.match(src,/scoreApps/);
 assert.match(src,/percentageApps/);
 assert.match(src,/opts\.comparisons\.length&&!await ownClasses/);
 assert.match(src,/class_id:b\.classId,options/);
 assert.match(src,/onConflict:'class_id'/);
 assert.doesNotMatch(src,/service_role.*respond|password.*console\./);
});
