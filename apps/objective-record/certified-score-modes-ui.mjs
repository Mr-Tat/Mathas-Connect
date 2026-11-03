// School score modes: native 3-vies / Mort subite / HARD, but ONLY an issued
// server challenge can award XP. The browser does not report its score.
const CLASS_TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const MODES=Object.freeze(['three-lives','sudden','hard-three-lives','hard-sudden']);
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const WIDTHS=Object.freeze({
 'addition-ecrite-simple':{3:1,5:2,7:3},
 'addition-ecrite-multiple':{5:1,6:2,7:3}
});
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const validQuestions=raw=>Array.isArray(raw)&&raw.length===64
 &&raw.every((q,i)=>q?.id==='q'+(i+1)
  &&q.op==='add'&&Array.isArray(q.addends)
  &&q.addends.length>=2&&q.addends.length<=7
  &&q.addends.every(n=>typeof n==='string'&&/^[1-9][0-9]{0,15}$/.test(n)));
const proofAnswer=(raw,q,width)=>{
 if(raw?.id!==q.id||!Array.isArray(raw.digits)||!Array.isArray(raw.carries))return null;
 const sum=q.addends.reduce((a,n)=>a+BigInt(n),0n);
 if(raw.digits.length!==sum.toString().length||raw.carries.length!==width)return null;
 if(!raw.digits.every(n=>typeof n==='string'&&/^[0-9]?$/.test(n)))return null;
 if(!raw.carries.every(n=>typeof n==='string'&&/^[0-6]?$/.test(n)))return null;
 return {id:q.id,digits:[...raw.digits],carries:[...raw.carries]};
};
function widthFor(app,mode,level){
 if(mode.startsWith('hard-'))return app==='addition-ecrite-simple'
  ?({1:10,2:12,3:16})[level]:({1:9,2:12,3:14})[level];
 return app==='addition-ecrite-simple'?({1:3,2:5,3:7})[level]:level+4;
}
export function createCertifiedScoreModesUI({getContext,call,refresh,notify,onRecorded=()=>{},storage=localStorage}){
 let run=null,starting=false,sending=false,docSeen=null,bypass=null;
 const current=seq=>getContext().generation===seq
  &&getContext().activeApp===run?.appKey;
 const keyFor=ctx=>['mathas-mode-proof-v1',ctx.pupilId,ctx.classId,ctx.activeApp].join(':');
 const store=()=>{try{
  if(run)storage.setItem(run.key,JSON.stringify({sessionId:run.sessionId,
   mode:run.mode,level:run.level,answers:run.answers,completed:run.completed}));
  return true;
 }catch{return false}};
 const discard=()=>{if(run?.key){try{storage.removeItem(run.key)}catch{}}run=null};
 const innerRun=()=>run&&current(run.generation);
 function reset(){run=null;starting=false;sending=false;docSeen=null;bypass=null}
 async function finish(){
  if(!innerRun()||!run.completed||sending)return;
  sending=true;const active=run;
  const answers=[...active.answers].sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
  if(answers.length<1||answers.length>64||
    answers.some((x,i)=>x.id!=='q'+(i+1))){
   notify('⚠️ Épreuve incomplète : la preuve des calculs ne peut pas être envoyée.');
   sending=false;return;
  }
  try{
   const ack=await call('finish-mode-v1',{sessionId:active.sessionId,answers});
   if(!current(active.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
    ||!Number.isSafeInteger(ack.xp?.delta)||ack.verifiedScore<0||ack.verifiedScore>answers.length)
     throw Error('Le résultat n’est pas confirmé par Connect');
   const modeName=active.mode==='three-lives'?'3 vies':
     active.mode==='sudden'?'Mort subite':
     active.mode==='hard-three-lives'?'HARD · 3 vies':'HARD · Mort subite';
   discard();
   try{if(ack.duplicate!==true)onRecorded({appKey:active.appKey,eventId:active.sessionId})}
   catch{/* Projection optional; cannot alter an XP transaction. */}
   let fresh=true;try{await refresh()}catch{fresh=false}
   notify('✅ '+modeName+' vérifié : '+ack.verifiedScore+
    ' bonnes réponses · +'+ack.xp.delta+' XP Connect.'+
    (fresh?'':' Actualiser pour relire les résultats.'));
  }catch(e){
   if(current(active.generation))notify('⚠️ Résultat conservé, clique sur Actualiser : '+e.message);
  }finally{sending=false}
 }
 function pick(doc,event){
  const target=event.target?.closest?.('button');
  if(!target)return null;
  const hard=!!target.closest('#hardMenuScreen,#hardMenu');
  if(hard){
   let mode=null;
   if(target.matches('.mlab-three,[data-mode="three-lives"]'))mode='hard-three-lives';
   if(target.matches('.hard-sudden,[data-mode="sudden"]'))mode='hard-sudden';
   if(!mode)return null;
   const card=target.closest('.hard-level-card,.hard-card');
   const text=card?.querySelector('h3')?.textContent||'';
   const level=Number(target.dataset.level||text.match(/[123]/)?.[0]);
   if(![1,2,3].includes(level))return null;
   return {mode,level,target};
  }
  if(target.id!=='startThreeLives'&&target.id!=='startSudden')return null;
  const select=doc.getElementById('suddenMaxDigits');
  const ctx=getContext();
  const level=WIDTHS[ctx.activeApp]?.[Number(select?.value)];
  if(![1,2,3].includes(level))return null;
  return {mode:target.id==='startThreeLives'?'three-lives':'sudden',level,target};
 }
 async function start({target,mode,level},win,doc){
  const ctx=getContext();
  if(starting||sending||run||!APPS.has(ctx.activeApp)
    ||ctx.classId===CLASS_TEST||!ctx.pupilId)return;
  const seq=ctx.generation;
  starting=true;
  try{
   const data=await call('start-mode-v1',{mode,level});
   if(seq!==getContext().generation||!APPS.has(getContext().activeApp))return;
   if(!UUID.test(data?.sessionId)||data.mode!==mode||data.level!==level
    ||!validQuestions(data.questions)||Date.parse(data.expiresAt)<=Date.now())
      throw Error('Défi mathématique serveur indisponible');
   const key=keyFor(ctx);
   run={sessionId:data.sessionId,mode,level,appKey:ctx.activeApp,
    generation:seq,key,questions:data.questions,answers:[],completed:false,
    nativeMode:mode.endsWith('three-lives')?'three-lives':'sudden',
    width:widthFor(ctx.activeApp,mode,level)};
   // Do not silently overwrite a completed proof awaiting retry.
   let previous=null;try{previous=JSON.parse(storage.getItem(key)||'null')}catch{}
   if(previous?.sessionId===run.sessionId&&previous.completed===true&&
      previous.mode===mode&&Array.isArray(previous.answers)&&previous.answers.length>0){
     run.answers=previous.answers;run.completed=true;
     notify('Reprise de la sauvegarde des résultats certifiés…');
     void finish();return;
   }
   if(!store())throw Error('Sauvegarde locale des essais indisponible');
   win.__mathasServerCertifiedModes={sessionId:run.sessionId,mode,
    level,nativeMode:run.nativeMode,questions:run.questions,index:0};
   if(!doc.contains(target))throw Error('Le bouton du jeu a changé');
   bypass=target;target.click();
   notify('🔐 '+(mode.startsWith('hard-')?'HARD · ':'')+
     (mode.endsWith('three-lives')?'3 vies':'Mort subite')+
     ' niveau '+level+' : chaque calcul et chaque retenue seront contrôlés par Connect.');
  }catch(e){
   if(seq===getContext().generation){
    discard();notify('⚠️ '+e.message+' : aucun XP officiel demandé.');
   }
  }finally{starting=false}
 }
 function bind(win,doc){
  const ctx=getContext();
  if(!win||!doc?.getElementById('menuScreen')
    ||!APPS.has(ctx.activeApp)||ctx.classId===CLASS_TEST||!ctx.pupilId)return;
  win.MathasCertifiedModeAttempt=raw=>{
   if(!innerRun()||sending||run.completed)return;
   const n=Number(String(raw?.id||'').slice(1));
   if(!Number.isSafeInteger(n)||n<1||n>64)return;
   const q=run.questions[n-1],proof=proofAnswer(raw,q,run.width);
   if(!proof){run.invalid=true;notify('Première réponse invalide : aucun XP attribué.');return;}
   if(run.answers.some(x=>x.id===proof.id))return;
   run.answers.push(proof);
   if(!store())run.invalid=true;
   if(run.answers.length===64&&!run.invalid){
    run.completed=true;store();void finish();
   }
  };
  if(docSeen===doc)return;
  docSeen=doc;
  doc.addEventListener('click',event=>{
   if(event.target?.closest?.('button')===bypass){bypass=null;return}
   const cfg=pick(doc,event);
   if(!cfg)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(run){notify('Une partie certifiée est déjà en cours.');return}
   void start(cfg,win,doc);
  },true);
 }
 function onGameEvent(event){
  if(!run||!innerRun())return false;
  if(!event)return false;
  if(event.phase==='ended'&&event.mode===run.nativeMode
     &&event.hard===run.mode.startsWith('hard-')
     &&event.level===run.level){
   if(run.invalid){notify('Une preuve a été perdue : aucun XP attribué.');return true}
   run.completed=true;store();void finish();
   return true;
  }
  return true;
 }
 return Object.freeze({reset,bind,onGameEvent,
  hasPending:()=>!!run?.completed,
  retry:()=>run?.completed?finish():Promise.resolve()});
}
