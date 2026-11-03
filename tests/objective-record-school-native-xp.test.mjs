// No credentials and no student DB: pure contract for the native XP bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNativeLaunch,xpStillAvailable} from '../apps/objective-record/native-connect-bridge.mjs';

const xp={milestones:[],currentMilestones:[],parcours:1,repeatXp:false};
test('native buttons expose only milestones actually remaining in official Connect',()=>{
 assert.equal(xpStillAvailable(xp,'classic',1,4),22);
 assert.equal(xpStillAvailable(xp,'classic',2,10),36);
 assert.equal(xpStillAvailable(xp,'classic',3,20),60);
 assert.equal(xpStillAvailable(xp,'sudden',1),20);
 assert.equal(xpStillAvailable(xp,'hard',3),20);
 assert.equal(xpStillAvailable({...xp,milestones:['classic:2:10:pass','sudden:1:5','hard:3:7']},'classic',2,10),6);
 assert.equal(xpStillAvailable({...xp,milestones:['sudden:1:5']},'sudden',1),10);
 assert.equal(xpStillAvailable({...xp,milestones:['hard:3:3','hard:3:7']},'hard',3),0);
 assert.equal(xpStillAvailable({milestones:null},'classic',1,4),null,'never invent rewards');
 assert.equal(xpStillAvailable(xp,'classic',4,4),null,'invalid level has no award');
 assert.equal(xpStillAvailable({...xp,repeatXp:true,parcours:2,milestones:['classic:1:4:perfect']},'classic',1,4),22,'repeat parcours reads current milestone pool');
});

function button(id='',options={}){
 const mock={id,disabled:false,dataset:options.dataset||{},
   closest:selector=>selector==='#hardMenu'?options.inHard?{}:null:
    selector==='.hard-level-card,.hard-card'?options.card||null:null,
   matches:selector=>selector.split(',').some(c=>(options.classes||[]).includes(c.trim()))};
 return mock;
}
const select=(level)=>({selectedOptions:[{textContent:'Niveau '+level}]});
const doc={getElementById:id=>({classicMaxDigits:select(2),suddenMaxDigits:select(3)})[id],
 querySelector:()=>({dataset:{count:'20'}})};
test('normal native launches route through the exact authenticated proof modes',()=>{
 assert.deepEqual(classifyNativeLaunch(button('startClassic'),doc,'addition-ecrite-multiple'),{mode:'classic',level:2,total:20});
 assert.deepEqual(classifyNativeLaunch(button('',{classes:['.classic-count-btn[data-count]'],dataset:{count:'4'}}),doc,'addition-ecrite-simple'),
  {mode:'classic',level:2,total:4});
 assert.deepEqual(classifyNativeLaunch(button('startThreeLives'),doc),{mode:'three-lives',level:3});
 assert.deepEqual(classifyNativeLaunch(button('startSudden'),doc),{mode:'sudden',level:3});
});
test('HARD modes share server proof but training remains a free game',()=>{
 const card={querySelector:()=>({textContent:'HARD NIV 2'})};
 const hard=options=>button('',{inHard:true,card,...options});
 assert.deepEqual(classifyNativeLaunch(hard({dataset:{level:'2',mode:'sudden'}}),doc),
  {mode:'hard-sudden',level:2});
 assert.deepEqual(classifyNativeLaunch(hard({dataset:{level:'2',mode:'three-lives'}}),doc),
  {mode:'hard-three-lives',level:2});
 assert.equal(classifyNativeLaunch(hard({dataset:{level:'2',mode:'training'}}),doc),null);
 assert.equal(classifyNativeLaunch(hard({dataset:{level:'2',mode:'challenge'}}),doc),null);
 assert.equal(classifyNativeLaunch(button('startTraining'),doc),null);
 const disabled=button('startSudden');disabled.disabled=true;
 assert.equal(classifyNativeLaunch(disabled,doc),null);
});
