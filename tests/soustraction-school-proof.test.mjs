import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 acceptSubtractionChallenge,acceptSubtractionExtended,
 subtractionAttemptCorrect,subtractionEndState,subtractionTranscriptStore,
 expectedSubtractionWidth
} from '../apps/soustraction-simple/certified-school.mjs';
import {xpStillAvailable} from '../apps/objective-record/native-connect-bridge.mjs';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const sql=source('../supabase/migrations/20261104220000_school_subtraction_certified_projection.sql');
const edge=source('../supabase/functions/connect-soustraction-school/index.ts');
const projection=source('../supabase/functions/connect-projection-v2/index.ts');
const results=source('../supabase/functions/connect-results/index.ts');
const page=source('../apps/soustraction-simple/index.html');
const school=source('../apps/soustraction-simple/school-ui.mjs');
const UUID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const q=(i,method='addBottom',a='10234',b='1234')=>
 ({id:'q'+(i+1),op:'sub',a,b,method,width:a.length});
const challenge=(mode='classic',method='addBottom')=>({
 ok:true,sessionId:UUID,revision:0,resetEpoch:0,level:2,method,
 total:4,limit:120,mode,expiresAt:'2099-01-01T00:00:00Z',
 questions:Array.from({length:mode==='classic'?4:120},(_,i)=>q(i,method))
});
test('défis classiques émis par le serveur, calcul exact et deux méthodes',()=>{
 const a=challenge();
 assert.ok(acceptSubtractionChallenge(a,2,4,'addBottom'));
 assert.equal(acceptSubtractionChallenge(a,1,4,'addBottom'),null);
 assert.equal(acceptSubtractionChallenge(a,2,10,'addBottom'),null);
 assert.equal(acceptSubtractionChallenge(a,2,4,'takeTop'),null);
 assert.equal(subtractionAttemptCorrect(a.questions[0],'9000'),true);
 assert.equal(subtractionAttemptCorrect(a.questions[0],'8999'),false);
 assert.equal(subtractionAttemptCorrect(a.questions[0],'9999'),false);
 assert.equal(subtractionAttemptCorrect(a.questions[0],'-10'),false);
 assert.equal(subtractionAttemptCorrect(a.questions[0],'9a00'),false);
 const b=challenge('classic','takeTop');
 assert.ok(acceptSubtractionChallenge(b,2,4,'takeTop'));
 b.questions[0].a='9';assert.equal(acceptSubtractionChallenge(b,2,4,'takeTop'),null);
});
test('modes HARD, 3 vies et Mort subite ne sont pas confondus',()=>{
 assert.equal(expectedSubtractionWidth('hard-three-lives',1),10);
 assert.equal(expectedSubtractionWidth('hard-sudden',3),16);
 assert.equal(expectedSubtractionWidth('three-lives',2),5);
 const a=challenge('hard-three-lives','takeTop');
 a.questions=Array.from({length:120},(_,i)=>q(i,'takeTop','1000000000','123456789'));
 assert.ok(acceptSubtractionExtended(a,2,'hard-three-lives','takeTop')===null);
 a.questions=Array.from({length:120},(_,i)=>q(i,'takeTop','100000000000','123456789'));
 assert.ok(acceptSubtractionExtended(a,2,'hard-three-lives','takeTop'));
 const answers=a.questions.slice(0,3).map(q=>({id:q.id,answer:'1'}));
 const end=subtractionEndState('hard-three-lives',answers,a.questions);
 assert.equal(end?.correct,0);assert.equal(end?.errors,3);assert.equal(end?.complete,true);
 assert.equal(subtractionEndState('hard-sudden',answers.slice(0,2),a.questions),null);
 assert.equal(subtractionEndState('hard-three-lives',[
   ...answers,{id:'q4',answer:'1'}],a.questions),null);
});
test('journal local lié au profil, à la classe, à la méthode et au mode',()=>{
 const map=new Map,storage={getItem:k=>map.get(k)??null,
  setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const s=subtractionTranscriptStore(storage,UUID,UUID,'classic',2,'addBottom');
 const data={...challenge(),mode:'classic',answers:[]};
 assert.equal(s.save(data),true);assert.ok(s.read());
 const other=subtractionTranscriptStore(storage,UUID,UUID,'classic',2,'takeTop');
 assert.equal(other.read(),null);
 assert.equal(s.clear(),true);assert.equal(s.read(),null);
});
test('SQL privé: pièces jointes des preuves, 5 + 5 et séparation native HARD',()=>{
 for(const fn of [
 'connect_objective_record_school_sub_record_classic_v1',
 'connect_objective_record_school_sub_issue_classic_v1',
 'connect_objective_record_school_sub_finish_classic_v1',
 'connect_objective_record_school_sub_record_extended_v1',
 'connect_objective_record_school_sub_issue_extended_v1',
 'connect_objective_record_school_sub_finish_extended_v1',
 'connect_projection_sub_verified_summary_v1',
 'connect_projection_sub_share_improved_v1']) {
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\('));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.'+fn+'('),fn+' doit être privé');
 }
 assert.match(sql,/hardThreeLives/);
 assert.match(sql,/threeLives/);
 assert.match(sql,/sudden:5:half/);
 assert.match(sql,/sudden:5:complement/);
 assert.match(sql,/connect_trophy_rewards_v1/);
 assert.match(sql,/proofVerified/);
 assert.match(sql,/p_method NOT IN \('addBottom','takeTop'\)/);
 assert.doesNotMatch(sql,/UPDATE\s+public\.connect_apps\s+SET\s+enabled/i);
});
test('API: JWT, classe approuvée, carte visible, aucune source client pour les scores',()=>{
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/device_not_approved/);
 assert.match(edge,/school_app_not_open_for_class/);
 assert.match(edge,/connect_hub_preset_entries/);
 assert.match(edge,/connect_objective_record_school_sub_finish_extended_v1/);
 assert.doesNotMatch(edge,/p_score:b\.score/);
 assert.match(results,/b\.appKey===sub\)\)/);
 assert.match(projection,/connect_projection_sub_verified_summary_v1/);
 assert.match(projection,/connect_projection_sub_share_improved_v1/);
});
test('écran scolaire: natif conservé, 3 vies, XP et projection sur preuve seulement',()=>{
 assert.match(page,/game-original\.html/);
 assert.match(page,/createCertifiedSubtraction/);
 assert.match(page,/createSchoolScoreView/);
 assert.match(page,/connect-soustraction-school/);
 assert.match(page,/proofVerified===true/);
 assert.match(page,/Anciens scores non certifiés conservés sans envoi/);
 assert.match(school,/mathasSubThreeLives/);
 assert.match(school,/data-mode="three-lives"/);
 assert.match(school,/installSubtractionSchoolUi/);
});
test('XP restant: demi-paliers puis complément sans double crédit',()=>{
 const xp={milestones:[],parcours:1,repeatXp:false};
 assert.equal(xpStillAvailable(xp,'three-lives',1),10);
 assert.equal(xpStillAvailable(xp,'sudden',1),20);
 xp.milestones.push('sudden:1:5:half');
 assert.equal(xpStillAvailable(xp,'three-lives',1),5);
 assert.equal(xpStillAvailable(xp,'sudden',1),15);
 xp.milestones.push('sudden:1:5:complement');
 assert.equal(xpStillAvailable(xp,'sudden',1),10);
});
