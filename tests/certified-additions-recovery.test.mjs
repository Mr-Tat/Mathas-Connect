import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdditionProofUI} from '../apps/objective-record/certified-addition-ui.mjs';
import {createMultipleProofUI} from '../apps/objective-record/certified-multiple-ui.mjs';
import {createCertifiedAdditionQueue} from '../apps/objective-record/certified-addition.mjs';
import {createMultiProofQueue} from '../apps/objective-record/certified-multiple.mjs';
const classId='61d56329-390a-4c13-9e77-1e118e38d44a',pupilId='7c5784e6-fdf4-4d73-9ed3-2649064ace23';
const sessionId='326a0203-4046-4ad0-ad25-8c03d4d32a46';
for(const [name,createUI,createQueue,appKey,action] of [
 ['simple',createAdditionProofUI,createCertifiedAdditionQueue,'addition-ecrite-simple','finish-proof-v2'],
 ['multiple',createMultipleProofUI,createMultiProofQueue,'addition-ecrite-multiple','finish-proof-multi-v1']
]){
 test(name+' : reprise durable de la preuve complète sans nouveau départ',async()=>{
  const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
  const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  try{
   const queue=createQueue({storage,studentId:pupilId,classId});
   const answers=Array.from({length:4},(_,i)=>({id:'q'+(i+1),digits:['1'],carries:['']}));
   assert.equal(queue.save({sessionId,level:1,total:4,expiresAt:'2000-01-01T00:00:00Z'},answers),true);
   let connected=false,calls=[],recorded=[];
   const make=()=>createUI({button:{addEventListener(){},dataset:{}},panel:{},levelSelect:{},totalSelect:{},modeSelect:{},frame:{contentDocument:null},
    getContext:()=>({generation:1,activeApp:appKey,pupilId,classId}),call:async(a,p)=>{calls.push([a,p]);if(!connected)throw Error('offline');return {proofVerified:true,verifiedScore:4,xp:{delta:0},duplicate:true}},
    refresh:async()=>{},notify:()=>{},onRecorded:r=>recorded.push(r)});
   const before=make();await before.recover();assert.equal(before.hasPending(),true);assert.ok(queue.read({allowExpired:true}));
   const after=make();connected=true;await after.recover();
   assert.equal(after.hasPending(),false);assert.equal(queue.read({allowExpired:true}),null);
   assert.deepEqual(calls,[[action,{sessionId,answers}],[action,{sessionId,answers}]]);
   assert.deepEqual(recorded,[{eventId:sessionId,appKey,duplicate:true}]);
   await after.recover();assert.equal(calls.length,2);
  }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage}
 });
}
