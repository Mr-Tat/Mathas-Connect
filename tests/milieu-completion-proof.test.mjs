import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeNativeCompletion} from '../apps/DIV-Milieu-de-segment-1/connect/completion-proof.mjs';
const item=(n,steps=["calc"],helps=[])=>({n,helps,attempts:steps.map(stage=>stage==="calc"?{stage,value:n/2}:stage==="measure"?{stage,tick:n,value:n}:{stage,tick:n/2})});
const proof=(activity,items,mode=null)=>({version:1,activity,mode,items});
const measured=["measure","calc","place"];
test("six segments entiers, première erreur conservée malgré correction",()=>{
 const items=[10,20,30,40,50,60].map(n=>item(n,["calc","place"]));items[0].attempts.unshift({stage:"calc",value:0});items[1].helps=["manip"];
 const j=judgeNativeCompletion(proof("gi1",items));assert.equal(j.firstGood,5);assert.equal(j.assistedItems,1);assert.equal(j.errors,1);
});
test("la mesure doit être saisie et la graduation sélectionnée",()=>{
 const items=[10,20,30,40,50,60].map(n=>item(n,measured));assert.equal(judgeNativeCompletion(proof("gi2",items)).firstGood,6);
 delete items[0].attempts[0].tick;assert.throws(()=>judgeNativeCompletion(proof("gi2",items)));
});
test("générateurs stricts, total, absence de doublons, mélange équilibré",()=>{
 const items=[22,24,26,28,32].map(n=>item(n,["calc","place"]));assert.equal(judgeNativeCompletion(proof("g1",items)).total,5);
 assert.throws(()=>judgeNativeCompletion(proof("g1",[item(20,["calc","place"]),...items.slice(1)])));
 assert.throws(()=>judgeNativeCompletion(proof("g1",items.slice(1))));
 assert.throws(()=>judgeNativeCompletion(proof("g1",[items[0],...items.slice(0,4)])));
 assert.equal(judgeNativeCompletion(proof("mix",[10,20,30,40,50,60,70,80,90,100].map(n=>item(n)))).firstGood,10);
 assert.throws(()=>judgeNativeCompletion(proof("mix",Array.from({length:10},(_,i)=>item((i+1)*20)))));
});
test("défis : arrêt à la première/troisième erreur, aucune aide",()=>{
 const good=item(10,measured),bad=n=>({n,helps:[],attempts:[{stage:"measure",tick:n,value:0}]});
 assert.equal(judgeNativeCompletion(proof("gi2",[good,bad(20)],"sudden")).firstGood,1);
 assert.throws(()=>judgeNativeCompletion(proof("gi2",[good,bad(20),bad(30)],"sudden")));
 assert.equal(judgeNativeCompletion(proof("gi2",[good,bad(20),bad(30),bad(40)],"lives")).errors,3);
 assert.throws(()=>judgeNativeCompletion(proof("gi2",[good,bad(20)],"lives")));
 good.helps=["manip"];assert.throws(()=>judgeNativeCompletion(proof("gi2",[good,bad(20)],"sudden")));
});
test("défi illimité, cycle entier renouvelé, longueur décimale incompatible",()=>{
 const items=[...Array.from({length:20},(_,i)=>item((i+1)*10,measured)),item(10,measured),{n:20,helps:[],attempts:[{stage:"measure",tick:20,value:0}]}];
 assert.equal(judgeNativeCompletion(proof("gi2",items,"sudden")).firstGood,21);
 assert.throws(()=>judgeNativeCompletion(proof("g3",items,"sudden")));
});
test("preuve incomplète, valeur non entière, activité héritée ou mode test refusés",()=>{
 assert.throws(()=>judgeNativeCompletion(proof("even",[item(20)])));
 assert.throws(()=>judgeNativeCompletion(proof("g4",[])));
 assert.throws(()=>judgeNativeCompletion({...proof("gi2",[]),practice:true}));
 const items=[10,20,30,40,50,60].map(n=>item(n,["calc","place"]));items[0].attempts[0].value=5.5;assert.throws(()=>judgeNativeCompletion(proof("gi1",items)));
});
