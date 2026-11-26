import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appendMilieuProgress} from '../supabase/functions/connect-api/milieu-profile-progress.mjs';
const cls='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const previous={apps:[{appKey:'abaque-longueurs',xpEarned:22,xpMax:204,trophiesEarned:1,trophiesMax:6}],other:'preserved'};
const opts={url:'https://awmhpfofacaglewammxt.supabase.co',classId:cls,actor:'actor',teacher:false,studentId:'pupil'};
test('badge TEST, identité validée et droits permanents sans compter les recrédits',async()=>{
 let calls=0;const db={rpc:async(name,args)=>{calls++;assert.equal(name,'connect_milieu_load_v2');assert.deepEqual(args,{p_actor:'actor',p_class:cls,p_teacher:false,p_expected:'pupil'});return {data:{ok:true,appKey:'milieu-segment',studentId:'pupil',state:{rights:{a:20,b:12},bonusRights:{c:20},archivedBonusXp:400,cups:{a:true,b:true}}}}}};
 const v=await appendMilieuProgress(previous,{...opts,db});assert.equal(calls,1);assert.deepEqual(v.apps,[...previous.apps,{appKey:'milieu-segment',xpEarned:32,xpMax:280,trophiesEarned:2,trophiesMax:12}]);assert.equal(previous.apps.length,1);assert.equal(v.other,'preserved');
 for(const change of [{classId:'other'},{setting:'closed'},{url:'https://other.supabase.co'}])assert.equal(await appendMilieuProgress(previous,{...opts,...change,db}),previous);
 assert.equal(calls,1);
 const school='1b021ed9-4846-4203-9c7b-4b5fa8d7adab';let checked=0;const schoolDb={rpc:async(_name,args)=>{checked++;assert.equal(args.p_class,school);return {error:{message:'app_class_not_open'}}}};assert.equal(await appendMilieuProgress(previous,{...opts,classId:school,db:schoolDb}),previous);assert.equal(checked,1);assert.equal(await appendMilieuProgress(previous,{...opts,classId:school,setting:'pilot',db:schoolDb}),previous);assert.equal(checked,1);
});
test('absence de profil ou panne : aucun faux 0 XP ; nouveau profil approuvé : 0/280 et 0/12',async()=>{
 for(const response of [{error:{message:'denied'}},{data:{ok:true,appKey:'milieu-segment',studentId:'other',state:{}}},{data:{ok:true,appKey:'milieu-segment',studentId:'pupil',state:{rights:{a:281}}}}])assert.equal(await appendMilieuProgress(previous,{...opts,db:{rpc:async()=>response}}),previous);
 const v=await appendMilieuProgress(previous,{...opts,db:{rpc:async()=>({data:{ok:true,appKey:'milieu-segment',studentId:'pupil',state:{}}})}});
 assert.deepEqual(v.apps.at(-1),{appKey:'milieu-segment',xpEarned:0,xpMax:280,trophiesEarned:0,trophiesMax:12});
});
test('Toutes/TEST : entrée Connect explicite pour les deux profils, retour sans promotion élève',()=>{
 const html=readFileSync(new URL('../apps/DIV-Milieu-de-segment-1/index.html',import.meta.url),'utf8'),hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8'),edge=readFileSync(new URL('../supabase/functions/connect-api/index.ts',import.meta.url),'utf8');
 assert.match(html,/if\(!officialRequired&&hubAccess&&params\.get\("class"\)==="4bf3400d-a315-4ea4-a2f3-afaca24dc9b9"\)\{const connectButton/);
 assert.match(html,/if\(params\.get\("joueur"\)==="prof"\)u\.searchParams\.set\("joueur","prof"\)/);
 assert.match(hub,/!connectedGameKeys\.has\(appKey\)&&appKey!=='milieu-segment'/);
 assert.match(edge,/appendMilieuProgress\(data,\{db,url,setting:Deno\.env\.get\('CONNECT_MILIEU_ACCESS'\)/);
});
