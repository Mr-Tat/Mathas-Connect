import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanScoreEntry,schoolScoreSnapshot,canShareBestScore,nativeDayPoints} from '../apps/objective-record/school-score-view.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const stamp=new Date().toISOString();
const event=(id,mode,score,points,total=null)=>({
 eventId:'aaaaaaaa-'+id+'-4aaa-8aaa-aaaaaaaaaaaa',
 mode,score,points,total,at:stamp
});
test('Les 2 additions : exercices, 3 vies et Mort subite participent tous au top en POINTS',()=>{
 const classic=event('1111','classic',10,30,10);
 const lives=event('2222','three-lives',7,45);
 const sudden=event('3333','sudden',6,50);
 const hard=event('4444','hard-three-lives',5,70);
 const score=schoolScoreSnapshot({ok:true,events:[classic,lives,sudden,hard],
  bestThree:[hard,sudden,lives],todayBest:hard,boardBest:45},{});
 assert.deepEqual(score.top.map(r=>r.points),[70,50,45]);
 assert.equal(score.today.mode,'hard-three-lives');
 assert.equal(score.today.points,70);
 assert.equal(score.boardBest,45);
 assert.equal(canShareBestScore(score),true);
 assert.equal(score.recent[1].total,null,'pas de faux score /0 en 3 vies');
});
test('Egal ou inférieur au score du tableau : aucun nouvel envoi',()=>{
 const best=event('5555','sudden',8,90);
 for(const value of [90,100]){
  const score=schoolScoreSnapshot({ok:true,events:[best],todayBest:best,bestThree:[best],boardBest:value},{});
  assert.equal(canShareBestScore(score),false);
 }
 const noEvent=schoolScoreSnapshot({ok:true,events:[],bestThree:[],todayBest:null,boardBest:0},{});
 assert.equal(canShareBestScore(noEvent),false);
});
test('Sans Connect, un score local ne peut jamais provoquer un envoi au tableau',()=>{
 const a=event('6666','classic',4,22,4);
 const snapshot=schoolScoreSnapshot(null,{recent:[a]});
 assert.equal(snapshot.today.points,22);
 assert.equal(canShareBestScore(snapshot),false);
 assert.equal(snapshot.official,false);
 assert.equal(cleanScoreEntry({...a,total:null}).total,null);
});
test('Le nombre natif s’extrait sans le macaron Record, et non d’une étiquette inventée',()=>{
 const withRecord={querySelector:()=>({firstElementChild:{textContent:'1\u202f234'},textContent:'1\u202f234★ RECORD'})};
 const zero={querySelector:()=>({firstElementChild:null,textContent:'0'})};
 const invalid={querySelector:()=>({firstElementChild:{textContent:'20 points'},textContent:'20 points'})};
 assert.equal(nativeDayPoints(withRecord),1234);
 assert.equal(nativeDayPoints(zero),0);
 assert.equal(nativeDayPoints(invalid),null);
 assert.equal(nativeDayPoints(null),null);
});
test('Les additions réutilisent les cartes natives et une invitation sécurisée sur le score affiché',()=>{
 const src=read('apps/objective-record/school-score-view.mjs');
 assert.match(src,/mathasPointsQuick/);
 assert.match(src,/\.mathas-points-quick-item--best/);
 assert.match(src,/nativeBestPoints/);
 assert.match(src,/displayed!==snapshot\.today\.points/);
 assert.match(src,/target\.addEventListener\('click',onClick\)/);
 assert.match(src,/target\.addEventListener\('keydown',onKeydown\)/);
 assert.match(src,/target===clickTarget/);
 assert.match(src,/removeEventListener\('click',onClick\)/);
 assert.doesNotMatch(src,/setProperty\('display','none','important'\)/);
 assert.doesNotMatch(src,/mathasSchoolScoreHistory|mathasSchoolScoreTop/);
 for(const game of ['addition-simple/game-original.html','addition-multiple/index.html']){
  const html=read('apps/objective-record/engines/'+game);
  assert.match(html,/id='mathasPointsQuick'/);
  assert.match(html,/id='mathasPointsDetail'/);
  assert.match(html,/mathas-v541-cup/);
 }
 assert.match(read('apps/objective-record/eleve.mjs'),/school-score-view\.mjs\?v=20261104-native-records-v1/);
 assert.match(read('apps/objective-record/eleve.html'),/eleve\.mjs\?v=20261104-three-lives-half-xp-v1/);
});
test('Protection Edge: RPC atomique, identité élève et preuve du résultat',()=>{
 const edge=read('supabase/functions/connect-projection-v2/index.ts');
 const sql=read('supabase/release-candidates/20261103_projection_additions_improved_only.sql');
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(edge,/student-score-history/);
 assert.match(edge,/connect_projection_addition_score_summary_v1/);
 assert.match(edge,/connect_projection_share_improved_addition_v1/);
 assert.match(edge,/connect_devices/);
 assert.match(edge,/connect_enrollments/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/v_points<=v_previous/);
 assert.match(sql,/event_not_found/);
 assert.match(sql,/score_reset/);
 assert.match(sql,/ON CONFLICT\(student_id,app_key,event_id\) DO NOTHING/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO service_role/);
 assert.match(host,/schoolScoreView\?\.mount\(doc\)/);
 assert.match(host,/schoolScoreView\?\.recorded\(receipt\.eventId\)/);
 assert.match(host,/schoolScoreView\.updateState\(latestState/);
});
