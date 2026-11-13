import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 multiplicationAmberFollower,updateMultiplicationAmber,installMultiplicationSchoolUi,normalizeMultiplicationCountCaption
} from '../apps/multiplication-simple/school-ui.mjs';
import {xpStillAvailable} from '../apps/objective-record/native-connect-bridge.mjs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('unverified multiplication results never invite sharing to projection',()=>{
 const launcher=source('../apps/multiplication-simple/index.html');
 assert.match(launcher,/installMultiplicationSchoolUi/);
 assert.doesNotMatch(launcher,/action:'game-record'/);
 assert.match(launcher,/certifiedScoreView\?\.recorded\(receipt\.eventId\)/);
 assert.match(launcher,/action:'student-score-history'/);
 assert.match(launcher,/createNativeCertifiedMultiplication/);
});

test('correct per-app XP pools: no invented credits for a session',()=>{
 const xp={milestones:[],parcours:1,repeatXp:false};
 assert.equal(xpStillAvailable(xp,'classic',1,4),22);
 assert.equal(xpStillAvailable(xp,'classic',1,10),36);
 assert.equal(xpStillAvailable(xp,'classic',1,20),60);
 assert.equal(xpStillAvailable(xp,'sudden',1),40);
 assert.equal(xpStillAvailable(xp,'hard',1),40);
 assert.equal(xpStillAvailable({...xp,milestones:['classic:1:4:perfect']},'classic',1,4),0);
 assert.equal(xpStillAvailable({...xp,repeatXp:true,parcours:2,currentMilestones:[]},'classic',1,4),22);
 assert.equal(xpStillAvailable({...xp,repeatXp:true,parcours:2},'classic',1,4),null);
 assert.equal(xpStillAvailable({...xp,milestones:null},'classic',1,4),null);
});

function blank(col){
 return {value:'',disabled:false,dataset:{col:String(col)},classList:{add(){},remove(){}}};
}
function field(type,col,parent){
 return {dataset:{col:String(col),carryCol:String(col)},disabled:false,value:'',
  matches(s){return s.includes(type)},
  closest(){return parent}};
}

test('above-method carry points to the following units digit',()=>{
 const unit=blank(0);
 const op={querySelector(sel){return sel.includes('data-col="0"')?unit:null}};
 const active=field('.carry-input',1,op);
 assert.equal(multiplicationAmberFollower(active,{querySelector(){}}),unit);
 unit.value='5';
 assert.equal(multiplicationAmberFollower(active,{querySelector(){}}),null);
});
test('multiplication HARD top carry and side carry use different destinations',()=>{
 const unit=blank(2);
 const op={querySelector(sel){return sel.includes('data-col="2"')?unit:null}};
 const carry=field('.hard-carry',3,op);
 assert.equal(multiplicationAmberFollower(carry,{querySelector(){}}),unit);
 const a=blank(1),b=blank(0);
 const doc={querySelector(sel){return sel==='.operation[data-calc="1"]'?{querySelectorAll(){return [a,b]}}:null}};
 const side={matches(sel){return sel==='.side-carry-input'},
  closest(){return {dataset:{sideCalc:'1'}}}};
 assert.equal(multiplicationAmberFollower(side,doc),b);
});

test('in-game school UI does not run without a native multiplication game',()=>{
 assert.equal(installMultiplicationSchoolUi(null),false);
 assert.equal(installMultiplicationSchoolUi({getElementById(){return null}}),false);
});

test('public routes remain legacy until server-certified multiplication proofs exist',()=>{
 const routing=source('../apps/objective-record/release-routing.mjs');
 const host=source('../apps/objective-record/eleve.mjs');
 assert.match(routing,/const ADDITION_KEYS=new Set\(\['addition-ecrite-simple','addition-ecrite-multiple'\]\)/);
 assert.match(host,/SERVER_PROOF_ADDITIONS=new Set\(\['addition-ecrite-simple','addition-ecrite-multiple'\]\)/);
});

test('les badges XP des séries ne sont jamais recopiés dans le grand libellé',()=>{
 for(const count of [4,10,20]){
  const badge={nodeType:1,className:'mathas-multi-official-xp',textContent:'Reste 36 XP'};
  const number={nodeType:1,className:'count-number',textContent:String(count)};
  const label={nodeType:3,textContent:' calculsReste 36 XP',remove(){throw Error('caption should survive')}};
  const button={
   dataset:{count:String(count)},childNodes:[number,label,badge],
   querySelector(selector){return selector===':scope > .count-number'?number:null}
  };
  assert.equal(normalizeMultiplicationCountCaption(button),true);
  assert.equal(label.textContent,' calculs');
  assert.equal(badge.textContent,'Reste 36 XP');
  assert.equal(number.textContent,String(count));
  assert.equal(normalizeMultiplicationCountCaption(button),false,'second refresh should not rewrite DOM');
 }
});
test('label normal sans count-number garde uniquement son indicateur de coin',()=>{
 const badge={nodeType:1,className:'mathas-multi-official-xp',textContent:'Reste 22 XP'};
 const label={nodeType:3,textContent:'4 calculsReste 22 XP'};
 const btn={dataset:{count:'4'},childNodes:[label,badge],querySelector(){return null}};
 assert.equal(normalizeMultiplicationCountCaption(btn),true);
 assert.equal(label.textContent,'4 calculs');
 assert.equal(badge.textContent,'Reste 22 XP');
 assert.equal(normalizeMultiplicationCountCaption(btn),false);
});
