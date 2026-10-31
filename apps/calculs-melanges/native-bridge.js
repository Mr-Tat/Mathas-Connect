// Loaded before the native engine. Explicit terminal hooks only; never observes storage.
(()=>{
 'use strict';
 const sessions=new WeakMap();let current=null;
 const rememberMaster=()=>{const p=sessions.get(current);if(p)p.master ||= window.__masterMode===true};
 document.addEventListener('click',e=>{if(e.target?.closest?.('#hintBtn,#aidBtn,#scoreRulerBtn,#tablesBtn,#hardTablesBtn,#hardHintBtn,#guideBtn,#hardGuideBtn')){const p=sessions.get(current);if(p)p.aid=true}queueMicrotask(rememberMaster)},true);
 document.addEventListener('keydown',()=>queueMicrotask(rememberMaster),true);
 const frame=window.frameElement;
 const lock=JSON.parse(frame?.getAttribute('data-multiplier-lock')||'null');
 Object.defineProperty(window,'__mathasMixedMultiplierLock',{value:lock});
 const number=name=>Number(frame?.getAttribute(name)||0);
 Object.defineProperty(window,'MathasMixedBridge',{value:Object.freeze({
  begin(s,hard){
   current=s;
   sessions.set(s,{hard,eventId:crypto.randomUUID(),selected:hard?['add','sub','mul']:[...s.ops],operations:[],first:[],ended:false,aid:false,
    master:window.__masterMode===true,revision:number('data-revision'),epoch:number('data-reset-epoch')});
  },
  solved(s,calc){const p=sessions.get(s);if(!p||p.ended)return;p.operations.push(calc.op);p.first.push(calc.firstTry===true);p.master ||= window.__masterMode===true;},
  finish(s){
   const p=sessions.get(s);if(!p||p.ended||s.mode==='training'||s.mode==='challenge')return;
   p.ended=true;
   document.dispatchEvent(new Event('mathas-mixed-finalized'));
   let rewards=null;try{rewards=JSON.parse(localStorage.getItem('mathas_trophies_v3_melange-calculs')||'null')}catch{}
   const event={schemaVersion:1,appKey:'melange-calculs-ecrits',eventId:p.eventId,
    mode:p.hard?'hard':s.mode,level:s.level,score:s.score,total:s.mode==='classic'?s.total:null,
    operationsSelectedAtStart:p.selected,operationsCompleted:p.operations,firstTry:p.first,
    rewards,aidUsed:p.aid||!!s.aidUsed,masterMode:p.master||window.__masterMode===true,expectedRevision:p.revision,expectedResetEpoch:p.epoch};
   parent.postMessage({type:'mathas-mixed-completion-v1',event},parent.location.origin);
  }
 }),writable:false,configurable:false});
})();
