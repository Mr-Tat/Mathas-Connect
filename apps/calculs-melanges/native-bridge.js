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
 Object.defineProperty(window,'__mathasMixedMultiplierVersion',{value:frame?.getAttribute('data-multiplier-lock-version')||null});
 Object.defineProperty(window,'__mathasMixedTeacherAllowTables',{value:frame?.getAttribute('data-table-aid-allowed')!=='false'});
 const number=name=>Number(frame?.getAttribute(name)||0);
 let checkingStart=false;
 async function authorizeStart(){
  if(checkingStart||document.body.inert||frame?.inert)return false;
  checkingStart=true;
  document.body.inert=true;
  let reply;
  try{reply=await frame?.mathasAuthorizeMixedStart?.()}catch{}
  finally{checkingStart=false;document.body.inert=!!frame?.inert}
  let status=document.getElementById('mathasMixedStartStatus');
  if(reply?.ok===true&&!frame?.inert){status?.remove();return true}
  if(!status){
   status=document.createElement('div');status.id='mathasMixedStartStatus';status.setAttribute('role','status');
   Object.assign(status.style,{position:'fixed',top:'12px',left:'50%',transform:'translateX(-50%)',width:'max-content',maxWidth:'calc(100% - 32px)',padding:'12px 16px',borderRadius:'12px',background:'#fff4d8',color:'#442800',fontWeight:'700',textAlign:'center',zIndex:'99999',pointerEvents:'none'});
   document.body.append(status);
  }
  status.textContent=reply?.message||'Connexion nécessaire pour commencer une nouvelle partie.';
  return false;
 }
 Object.defineProperty(window,'MathasMixedBridge',{value:Object.freeze({
  authorizeStart,
  begin(s,hard){
   current=s;
   sessions.set(s,{hard,eventId:crypto.randomUUID(),selected:hard?['add','sub','mul']:[...s.ops],operations:[],first:[],ended:false,aid:false,
    master:window.__masterMode===true,revision:number('data-revision'),epoch:number('data-reset-epoch')});
  },
  solved(s,calc){const p=sessions.get(s);if(!p||p.ended)return;p.operations.push(calc.op);p.first.push(calc.firstTry===true);p.master ||= window.__masterMode===true;},
  miss(s,calc){const p=sessions.get(s);if(!p||p.ended)return;p.operations.push(calc.op);p.first.push(false);p.master ||= window.__masterMode===true;},
  finish(s){
   const p=sessions.get(s);if(!p||p.ended||s.mode==='training'||s.mode==='challenge')return;
   p.ended=true;
   document.dispatchEvent(new Event('mathas-mixed-finalized'));
   let rewards=null;try{rewards=JSON.parse(localStorage.getItem('mathas_trophies_v3_melange-calculs')||'null')}catch{}
   const event={schemaVersion:1,appKey:'melange-calculs-ecrits',eventId:p.eventId,
    mode:p.hard?(s.mode==='three-lives'?'hard-three-lives':'hard'):s.mode,level:s.level,score:s.score,total:s.mode==='classic'?s.total:null,
    operationsSelectedAtStart:p.selected,operationsCompleted:p.operations,firstTry:p.first,
    rewards,aidUsed:p.aid||!!s.aidUsed,masterMode:p.master||window.__masterMode===true,expectedRevision:p.revision,expectedResetEpoch:p.epoch};
   parent.postMessage({type:'mathas-mixed-completion-v1',event},parent.location.origin);
  }
 }),writable:false,configurable:false});
})();
