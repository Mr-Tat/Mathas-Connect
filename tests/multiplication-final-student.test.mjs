import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {xpStillAvailable} from '../apps/objective-record/native-connect-bridge.mjs';
import {createSchoolScoreView,canShareBestScore,schoolScoreSnapshot} from '../apps/objective-record/school-score-view.mjs';
import {officialMultiplicationCups} from '../apps/multiplication-simple/school-ui.mjs';
import {
 acceptMultiplicationChallenge,acceptMultiplicationExtendedChallenge,
 normalizeMultiplicationAttempt,multiplicationAttemptCorrect,multiplicationEndState
} from '../apps/multiplication-simple/certified-classic.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const future='2099-01-01T00:00:00Z',uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const q=(i=1)=>({id:'q'+i,op:'mul',a:'345',m:8,width:3});
const attempt=id=>({id,digits:['0','6','7','2'],carries:['','4','3']});
const xp=(...milestones)=>({milestones});
test('Multiplication — 3 vies gagne 5 XP par palier, la Mort subite finit les 10 XP',()=>{
 assert.equal(xpStillAvailable(xp(),'three-lives',1),10);
 assert.equal(xpStillAvailable(xp(),'sudden',1),20);
 assert.equal(xpStillAvailable(xp('sudden:1:5:half'),'three-lives',1),5);
 assert.equal(xpStillAvailable(xp('sudden:1:5:half'),'sudden',1),15);
 assert.equal(xpStillAvailable(xp('sudden:1:5:half','sudden:1:5:complement','sudden:1:10:half'),'sudden',1),5);
 assert.equal(xpStillAvailable(xp('sudden:1:5','sudden:1:10'),'sudden',1),0);
});
test('HARD Multiplication — 3 et 7 réussites, moitié puis complément',()=>{
 assert.equal(xpStillAvailable(xp(),'hard-three-lives',2),10);
 assert.equal(xpStillAvailable(xp(),'hard-sudden',2),20);
 assert.equal(xpStillAvailable(xp('hard:2:3:half'),'hard-three-lives',2),5);
 assert.equal(xpStillAvailable(xp('hard:2:3:half'),'hard-sudden',2),15);
 assert.equal(xpStillAvailable(xp('hard:2:3:half','hard:2:7:half'),'hard-sudden',2),10);
 assert.equal(xpStillAvailable(xp('hard:2:3:half','hard:2:3:complement','hard:2:7:half','hard:2:7:complement'),'hard-sudden',2),0);
});
test('Premier calcul : chiffres inversés et reports sont bien contrôlés et signés',()=>{
 const classic={ok:true,sessionId:uuid,level:1,total:4,
  revision:0,resetEpoch:0,expiresAt:future,questions:[q(1),q(2),q(3),q(4)]};
 assert.ok(acceptMultiplicationChallenge(classic,1,4,[2,8]));
 assert.equal(acceptMultiplicationChallenge(classic,1,4,[2,9]),null);
 assert.deepEqual(normalizeMultiplicationAttempt(q(),attempt('q1')),attempt('q1'));
 assert.equal(multiplicationAttemptCorrect(q(),attempt('q1')),true);
 assert.equal(multiplicationAttemptCorrect(q(),{...attempt('q1'),carries:['','8','3']}),false);
 assert.equal(multiplicationAttemptCorrect(q(),{...attempt('q1'),digits:['0','6','7','9']}),false);
});
test('Mort subite et 3 vies terminent à la première ou troisième faute',()=>{
 const questions=Array.from({length:120},(_,i)=>q(i+1));
 const signed={ok:true,sessionId:uuid,level:1,mode:'three-lives',
  limit:120,width:3,revision:0,resetEpoch:0,expiresAt:future,questions};
 assert.ok(acceptMultiplicationExtendedChallenge(signed,1,'three-lives',[8]));
 const wrong=i=>({...attempt('q'+i),digits:['0','6','7','9']});
 assert.equal(multiplicationEndState('three-lives',[wrong(1),wrong(2)],questions).complete,false);
 assert.equal(multiplicationEndState('three-lives',[wrong(1),wrong(2),wrong(3)],questions).complete,true);
 assert.equal(multiplicationEndState('sudden',[wrong(1)],questions).complete,true);
 assert.equal(multiplicationEndState('sudden',[attempt('q1')],questions).complete,false);
});
test('Aucun trophée fictif : seule la structure de récompenses permanentes produit une coupe',()=>{
 assert.equal(officialMultiplicationCups(null,'classic',1),null);
 const rewards={version:3,mastery:{4:[true,false,false],10:[true,false,false],20:[true,false,false]},
  sudden:[false,true,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]}};
 assert.equal(officialMultiplicationCups(rewards,'classic',1)[0].earned,true);
 assert.deepEqual(officialMultiplicationCups(rewards,'sudden',2).map(x=>x.earned),[false,true,false]);
 assert.equal(officialMultiplicationCups(rewards,'classic',3)[0].earned,false);
});
test('Élève final : relais des deux boutons et consentement strict via scores certifiés',()=>{
 const student=read('apps/multiplication-simple/index.html');
 const ui=read('apps/multiplication-simple/school-ui.mjs');
 const score=read('apps/objective-record/school-score-view.mjs');
 assert.match(student,/mathas-multi-survival-options/);
 assert.match(student,/certifiedScoreView\?\.recorded\(receipt\.eventId\)/);
 assert.match(student,/action:'student-score-history'/);
 assert.doesNotMatch(student,/certifiedConsent\?\.offer\(receipt\.eventId\)/);
 assert.match(ui,/xpStillAvailable\(xp,'three-lives',lifeLevel\)/);
 assert.match(ui,/xpStillAvailable\(xp,'hard-three-lives',n\)/);
 assert.match(ui,/fonds et couleurs natifs restent inchangés/);
 assert.match(score,/multiplication-ecrite-simple/);
 assert.equal(typeof createSchoolScoreView,'function');
 const snap=schoolScoreSnapshot({ok:true,events:[],bestThree:[],boardBest:10,todayBest:null},{});
 assert.equal(canShareBestScore(snap),false);
});
test('Supabase : jalons partagés à moitié + scores Multiplication à preuve consommée',()=>{
 const sql=read('supabase/migrations/20261104191000_mul_survival_half_xp_verified_projection.sql');
 const edge=read('supabase/functions/connect-projection-v2/index.ts');
 for(const key of ['sudden:5:half','sudden:10:complement','hard:3:half','hard:7:complement',
  'connect_projection_mul_verified_summary_v1','connect_projection_mul_share_improved_v1','ps.consumed_at IS NOT NULL','es.consumed_at IS NOT NULL'])
  assert.ok(sql.includes(key),key);
 assert.ok(!sql.includes('delete from public.connect_xp_milestones'));
 assert.match(edge,/multiplication=b\.appKey==='multiplication-ecrite-simple'/);
 assert.match(edge,/connect_projection_mul_share_improved_v1/);
});
