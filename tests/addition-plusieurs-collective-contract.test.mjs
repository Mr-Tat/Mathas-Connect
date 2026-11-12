import test from 'node:test';
import assert from 'node:assert/strict';
import {validOperation,validSession,mayMoveForward,entryPage,resultOf} from '../apps/addition-plusieurs/collective-contract.mjs';
const p=[[{terms:['247','35','8']},{terms:['18','19','20']}],[{terms:['44','44']},{terms:['10','30']}],[{terms:['75','25']},{terms:['12','13']}]];
const s=()=>({ok:true,active:true,sessionId:'f7d3f280-726e-4e61-86d2-13256aac1746',revision:1,pages:p,pageIndex:2,requiredPages:[false,false,false]});
test('Deux opérations par page ; nombres positifs uniquement',()=>{
 assert.equal(validOperation({terms:['247','35','8']}),true);
 assert.equal(validOperation({terms:['0','9']}),false);
 assert.equal(validOperation({terms:['2.5','5']}),false);
 assert.equal(validSession(s()),true);
 assert.equal(validSession({...s(),pages:[[p[0][0]]]}),false);
});
test('Résultat addition à plusieurs termes, sans écrire dans les cases natives',()=>{
 assert.equal(resultOf(p[0][0]),'290');
 assert.equal(resultOf({terms:['9999999','9999999','9999999']}),'29999997');
});
test('Page ordinaire : progression autorisée même inachevée',()=>{
 assert.equal(mayMoveForward({session:s(),from:0,to:2,isFinished:()=>false}),true);
});
test('Obligation rétroactive : impossible de passer sans réussite',()=>{
 const x=s();x.requiredPages[0]=true;
 assert.equal(mayMoveForward({session:x,from:1,to:2,isFinished:()=>false}),false);
 assert.equal(mayMoveForward({session:x,from:1,to:2,isFinished:i=>i===0}),true);
});
test('Arrivée tardive : première obligation antérieure non réussie',()=>{
 const x=s();x.requiredPages[0]=true;
 assert.equal(entryPage(x,()=>false),0);
 assert.equal(entryPage(x,()=>true),2);
 assert.equal(entryPage(s(),()=>false),2);
});
