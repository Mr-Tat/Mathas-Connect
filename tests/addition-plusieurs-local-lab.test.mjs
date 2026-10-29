import test from 'node:test';import assert from 'node:assert/strict';import {createLocalLab} from '../apps/addition-plusieurs/local-lab.mjs';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
test('real completion to simulated XP, no duplicate award',async()=>{
 const received=[];const lab=createLocalLab({storage:storage(),onStatus:(status,reply)=>{if(status==='saved')received.push(reply.xp)}});
 assert.equal(lab.completed({label:'Calculs · Niveau 1',score:'4/4'}),true);
 assert.equal((await lab.flush()).remaining,0);
 assert.equal(received[0].appXp,22);
 lab.completed({label:'Calculs · Niveau 1',score:'4/4'});
 await lab.flush();
 assert.equal(received[1].delta,0);
 assert.equal(received[1].appXp,22);
});
