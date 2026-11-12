import test from 'node:test';
import assert from 'node:assert/strict';
import {validOperation,validSession,mayMoveForward,entryPage,resultOf} from '../apps/soustraction-simple/collective-contract.mjs';
const page=[[{a:'352',b:'187'},{a:'430',b:'251'}],[{a:'600',b:'238'},{a:'83',b:'27'}]];
const session=()=>({ok:true,active:true,sessionId:'f7d3f280-726e-4e61-86d2-13256aac1746',revision:1,borrowMethod:'takeTop',pages:page,pageIndex:1,requiredPages:[false,false]});
test('Soustractions à deux termes valides, sans résultat négatif',()=>{
 assert.equal(validOperation(page[0][0]),true);
 assert.equal(validOperation({a:'5',b:'9'}),false);
 assert.equal(resultOf(page[0][0]),'165');
});
test('La méthode native d’emprunt est explicitement conservée',()=>{
 assert.equal(validSession(session()),true);
 assert.equal(validSession({...session(),borrowMethod:'unknown'}),false);
});
test('Page ordinaire : avance libre sans corriger',()=>{
 assert.equal(mayMoveForward({session:session(),from:0,to:1,isFinished:()=>false}),true);
});
test('Obligation rétroactive : validée après correction',()=>{
 const s=session();s.requiredPages[0]=true;
 assert.equal(mayMoveForward({session:s,from:0,to:1,isFinished:()=>false}),false);
 assert.equal(mayMoveForward({session:s,from:0,to:1,isFinished:()=>true}),true);
});
test('Arrivée tardive sur page obligatoire ancienne',()=>{
 const s=session();s.requiredPages[0]=true;
 assert.equal(entryPage(s,()=>false),0);
 assert.equal(entryPage(s,()=>true),1);
});
