import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../apps/soustraction-simple/collective-native-bridge.js',import.meta.url),'utf8');
const digitsRTL=(value,length)=>Array.from({length},(_,c)=>Math.floor(value/10**c)%10);
function makeBridge(){const w={};runInNewContext(src,{window:w,digitsRTL});return w.MathasGuidedBridge}
const sessionId='f7d3f280-726e-4e61-86d2-13256aac1746';
function snapshot(page,states,overrides={}){return {sessionId,pages:[page],borrowMethod:'takeTop',...overrides,states}}
const page=[{a:'352',b:'187'},{a:'352',b:'187'}];
const n=String(352-187).padStart(3,'0').split('').reverse();
const good=()=>({answerValues:n,borrowed:[true,true,false],carry:[0,1,1],adjustValues:['','',''],adjustExpected:[null,null,null],wrongHistory:['','',''],firstTry:true,solved:true});
test('Emprunts en cascade : F5 conserve les états du moteur natif',()=>{
 const bridge=makeBridge();bridge.useSession(sessionId);
 assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[good(),good()]}],snapshot(page)),1);
 assert.equal(bridge.finishedAt(0),true);
});
test('F5 falsifié : une compensation incohérente invalide le brouillon',()=>{
 const bridge=makeBridge();bridge.useSession(sessionId);
 const invalid=good();invalid.carry[1]=0;
 assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[invalid,good()]}],snapshot(page)),0);
 assert.equal(bridge.finishedAt(0),false);
});
test('F5 : un résultat erroné ne restaure jamais la réussite, ni une autre séance',()=>{
 const bridge=makeBridge();bridge.useSession(sessionId);
 const invalid=good();invalid.answerValues[0]='0';
 assert.equal(bridge.restoreSnapshot([{index:0,operations:page,states:[invalid,good()]}],snapshot(page)),1);
 assert.equal(bridge.finishedAt(0),false);
 bridge.useSession('a7d3f280-726e-4e61-86d2-13256aac1746');
 assert.equal(bridge.finishedAt(0),false);
});
