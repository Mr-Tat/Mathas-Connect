import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../apps/addition-plusieurs/collective-native-bridge.js',import.meta.url),'utf8');
const digitsRTL=(value,length)=>Array.from({length},(_,c)=>Math.floor(value/10**c)%10);
function makeBridge(){const w={};runInNewContext(src,{window:w,digitsRTL});return w.MathasGuidedBridge}
const sessionId='f7d3f280-726e-4e61-86d2-13256aac1746';
function snapshot(page,states,overrides={}){return {sessionId,pages:[page],borrowMethod:'takeTop',...overrides,states}}
const page=[{addends:['99999','99999','99999']},{addends:['99999','99999','99999']}];
const n=String(99999*3).split('').reverse();
const good=()=>({answerValues:n,carryValues:['','2','2','2','2'],wrongHistory:Array(n.length).fill(''),carryWrong:Array(5).fill(''),firstTry:true,solved:true});
test('F5 valide : résultat multi-termes et vraies retenues supérieures à 1',()=>{
 const bridge=makeBridge();bridge.useSession(sessionId);
 assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[good(),good()]}],snapshot(page)),1);
 assert.equal(bridge.finishedAt(0),true);
});
test('F5 falsifié : retenue 2 absente ou mauvaise ne débloque pas la page',()=>{
 for(const carry of ['','1','3']){
  const bridge=makeBridge();bridge.useSession(sessionId);
  const invalid=good();invalid.carryValues[1]=carry;
  assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[invalid,good()]}],snapshot(page)),1);
  assert.equal(bridge.finishedAt(0),false);
 }
});
test('F5 : opération altérée, séance nouvelle et empreinte des termes bloquées',()=>{
 const bridge=makeBridge();bridge.useSession(sessionId);
 const other=[{addends:['99998','99999','99999']},page[1]];
 assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[good(),good()]}],snapshot(other)),0);
 bridge.useSession('a7d3f280-726e-4e61-86d2-13256aac1746');
 assert.equal(bridge.finishedAt(0),false);
});
