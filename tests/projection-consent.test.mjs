import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const get=path=>readFileSync(new URL(path,root),'utf8');
test('Consentement : question à chaque résultat, refus sans écriture et confirmation explicite',()=>{
 const s=get('projection-consent.mjs');
 assert.match(s,/Veux-tu envoyer ce score au tableau de projection/);
 assert.match(s,/Non, merci/);
 assert.match(s,/Oui, envoyer/);
 assert.match(s,/no.onclick=\(\)=>dismiss\(\)/);
 assert.match(s,/yes.onclick=\(\)=>/);
 assert.match(s,/student-share-score/);
 assert.match(s,/pending:\(\)=>read\(\).length/);
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:s,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('Consentement : les cinq jeux connectés déclenchent la question sur eventId lié à la sauvegarde',()=>{
 const add=get('apps/addition-plusieurs/index.html'),mixed=get('apps/calculs-melanges/index.html');
 const multi=get('apps/multiplication-simple/index.html'),sub=get('apps/soustraction-simple/index.html');
 const addPilot=get('apps/addition-plusieurs/connect-pilot.mjs');
 const mixedPilot=get('apps/calculs-melanges/connect-pilot.mjs');
 assert.match(add,/consent\?\.offer\(reply\.eventId\)/);
 assert.match(mixed,/consent\?\.offer\(reply\.eventId\)/);
 assert.match(multi,/consent\?\.offer\(eventId\)/);
 assert.match(sub,/consent\?\.offer\(eventId\)/);
 assert.match(addPilot,/onStatus\('pending',\{eventId:record\.eventId\}\)/);
 assert.match(mixedPilot,/onStatus\('pending',\{eventId:e\.eventId\}\)/);
 assert.doesNotMatch(add,/consent\?\.offer\(.*free/);
});
test('Consentement : API vérifie le joueur, la classe et ne lit que les preuves approuvées',()=>{
 const s=get('supabase/functions/connect-projection-v2/index.ts');
 const sql=get('supabase/release-candidates/20261031_projection_v2_explicit_score_consent.sql');
 assert.match(s,/b\.action==='student-share-score'/);
 assert.match(s,/connect_devices/);
 assert.match(s,/connect_enrollments/);
 assert.match(s,/player_not_approved/);
 assert.match(s,/connect_projection_score_consents/);
 assert.match(sql,/JOIN public\.connect_projection_score_consents c/);
 assert.match(sql,/c\.event_id=e\.event_id/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/TRUNCATE|DELETE FROM public\.connect_states/);
});

test('Consentement : refuser ne transmet rien ; accepter transmet exactement son eventId',async()=>{
 const {createProjectionConsent}=await import('../projection-consent.mjs');
 const elements=[];
 const documentRef={
  head:{append(){}},body:{append(){}},
  createElement(tag){
   const el={tag,children:[],hidden:false,textContent:'',onclick:null,
    append(...children){this.children.push(...children)},
    setAttribute(name,value){this[name]=value},focus(){}};
   elements.push(el);return el;
  }
 };
 const events=[],store=new Map(),storage={
  getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)
 };
 const windowRef={addEventListener(){}};
 const tool=createProjectionConsent({
  classId:'11111111-1111-4111-8111-111111111111',
  appKey:'addition-ecrite-simple',
  studentKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  getToken:async()=> 'FAKE_JWT_TEST_ONLY',
  documentRef,windowRef,storage,
  fetchImpl:async(url,params)=>{
   events.push(JSON.parse(params.body));
   return {ok:true,json:async()=>({ok:true,consentRecorded:true})}
  }
 });
 const no=elements.find(e=>e.textContent==='Non, merci');
 const yes=elements.find(e=>e.textContent==='Oui, envoyer');
 const rejected='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 const accepted='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 assert.equal(tool.offer(rejected),true);
 no.onclick();
 assert.equal(events.length,0);
 assert.equal(tool.offer(accepted),true);
 assert.equal(events.length,0,'no publication before YES click');
 yes.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(events.length,1);
 assert.equal(events[0].eventId,accepted);
 assert.equal(events[0].classId,'11111111-1111-4111-8111-111111111111');
 assert.equal(tool.pending(),0);
});
