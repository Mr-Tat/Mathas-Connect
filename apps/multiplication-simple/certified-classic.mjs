// Authenticated school CLASSIC multiplication — server-issued questions only.
// This UI never writes scores/XP/trophies and never makes a projection decision.
// The historic free V7 engine stays untouched in its iframe.
export const MULTIPLICATION_APP='multiplication-ecrite-simple';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLASSIC_COUNTS=[4,10,20],WIDTHS={1:3,2:5,3:7};
const isInt=Number.isSafeInteger;
export function acceptMultiplicationChallenge(data,level,total,multipliers){
 if(data?.ok!==true||!UUID.test(data.sessionId)
  ||data.level!==level||data.total!==total||!CLASSIC_COUNTS.includes(total)
  ||!Object.hasOwn(WIDTHS,level)||!isInt(data.revision)||data.revision<0
  ||!isInt(data.resetEpoch)||data.resetEpoch<0
  ||Date.parse(data.expiresAt)<=Date.now()
  ||!Array.isArray(data.questions)||data.questions.length!==total)return null;
 const allowed=new Set(multipliers);
 for(const [index,q] of data.questions.entries()){
  if(q?.id!=='q'+(index+1)||q.op!=='mul'||typeof q.a!=='string'
   ||!/^[1-9][0-9]{1,6}$/.test(q.a)||!isInt(q.m)||!allowed.has(q.m)
   ||!isInt(q.width)||q.a.length!==q.width
   ||q.width<WIDTHS[level]-1||q.width>WIDTHS[level])return null;
 }
 return Object.freeze({...data,questions:data.questions.map(q=>Object.freeze({...q}))});
}
export function normalizeMultiplicationAttempt(q,raw){
 if(!q||!raw||Object.keys(raw).sort().join(',')!=='carries,digits,id'
  ||raw.id!==q.id||!Array.isArray(raw.digits)||!Array.isArray(raw.carries))return null;
 const product=(BigInt(q.a)*BigInt(q.m)).toString();
 if(raw.digits.length!==product.length||raw.carries.length!==q.a.length
  ||!raw.digits.every(v=>typeof v==='string'&&/^[0-9]?$/.test(v))
  ||!raw.carries.every(v=>typeof v==='string'&&/^[0-8]?$/.test(v))
  ||!['','0'].includes(raw.carries[0]))return null;
 return Object.freeze({id:q.id,digits:[...raw.digits],carries:[...raw.carries]});
}
export function multiplicationAttemptCorrect(q,raw){
 const a=normalizeMultiplicationAttempt(q,raw);
 if(!a)return false;
 const product=BigInt(q.a)*BigInt(q.m),written=product.toString();
 for(let c=0;c<written.length;c++)
  if(a.digits[c]!==written[written.length-1-c])return false;
 for(let c=1;c<q.a.length;c++){
  const power=10n**BigInt(c);
  const carry=(BigInt(q.a)%power*BigInt(q.m))/power;
  if((a.carries[c]==='0'?'':a.carries[c])!==(carry===0n?'':carry.toString()))return false;
 }
 return true;
}

export const MULTIPLICATION_EXTENDED_MODES=Object.freeze([
 'sudden','three-lives','hard-sudden','hard-three-lives'
]);
const EXTENDED_WIDTHS=Object.freeze({normal:[3,5,7],hard:[10,12,16]});
export function expectedMultiplicationWidth(mode,level){
 if(!MULTIPLICATION_EXTENDED_MODES.includes(mode)||![1,2,3].includes(level))return null;
 return EXTENDED_WIDTHS[mode.startsWith('hard-')?'hard':'normal'][level-1];
}
export function acceptMultiplicationExtendedChallenge(data,level,mode,multipliers){
 const width=expectedMultiplicationWidth(mode,level),allowed=new Set(multipliers);
 if(width===null||data?.ok!==true||!UUID.test(data.sessionId)
  ||data.level!==level||data.mode!==mode||data.limit!==120||data.width!==width
  ||!isInt(data.revision)||data.revision<0||!isInt(data.resetEpoch)||data.resetEpoch<0
  ||Date.parse(data.expiresAt)<=Date.now()
  ||!Array.isArray(data.questions)||data.questions.length!==120)return null;
 for(const [i,q] of data.questions.entries()){
  if(q?.id!=='q'+(i+1)||q.op!=='mul'||typeof q.a!=='string'
   ||!/^[1-9][0-9]{1,15}$/.test(q.a)||!isInt(q.m)||!allowed.has(q.m)
   ||q.width!==q.a.length||q.width<width-1||q.width>width)return null;
 }
 return Object.freeze({...data,total:120,questions:data.questions.map(q=>Object.freeze({...q}))});
}
export function multiplicationEndState(mode,answers,questions){
 const classic=mode==='classic',limit=mode.endsWith('three-lives')?3:1;
 let correct=0,wrong=0;
 for(let i=0;i<answers.length;i++){
  if(!classic&&wrong>=limit)return {valid:false,complete:false,correct,wrong};
  if(multiplicationAttemptCorrect(questions[i],answers[i]))correct++;else wrong++;
 }
 return {valid:true,correct,wrong,
  complete:classic?answers.length===questions.length:wrong===limit||answers.length===120,
  lives:classic?null:Math.max(0,limit-wrong)};
}

export function multiplicationQueue(storage,studentId,classId,mode='classic',level=0){
 if(!UUID.test(studentId)||!UUID.test(classId))return null;
 const key=(mode==='classic'?'mathas.multi.certified-classic.v1.':'mathas.multi.certified-extended.v1.'+mode+'.'+level+'.')+classId+'.'+studentId;
 const cap=mode==='classic'?20:120;
 return {
  read(){try{const v=JSON.parse(storage.getItem(key));return v&&UUID.test(v.sessionId)
    &&Array.isArray(v.answers)&&v.answers.length<=cap
    &&Date.parse(v.expiresAt)>Date.now()?v:null}catch{return null}},
  save(challenge,answers){
   try{
    if((mode==='classic'&&!CLASSIC_COUNTS.includes(challenge.total))||answers.length>cap)return false;
    storage.setItem(key,JSON.stringify({
     sessionId:challenge.sessionId,expiresAt:challenge.expiresAt,
     mode,level:challenge.level,total:challenge.total,answers}));return true;
   }catch{return false}
  },
  clear(){try{storage.removeItem(key)}catch{}}
 };
}
const CSS=[
 '#mathasMultiCertified{position:fixed;z-index:100000;inset:5vh min(3vw,28px);overflow:auto;',
 'background:#08283d;color:#f7fbff;border:2px solid #7aa3ba;border-radius:16px;',
 'box-shadow:0 15px 70px #000b;padding:14px;display:flex;flex-direction:column;gap:11px}',
 '#mathasMultiCertified[hidden]{display:none!important}',
 '#mathasMultiCertified h2{margin:0;font-size:clamp(17px,3vw,23px);color:#ffe4ae}',
 '#mathasMultiCertified .mul-proof-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}',
 '#mathasMultiCertified .mul-proof-note{color:#c9e5f3;font-size:13px;max-width:680px}',
 '#mathasMultiCertified .mul-proof-board{margin:auto;max-width:100%;overflow-x:auto;padding:12px;',
 'background:#0b2134;border:1px solid #466a85;border-radius:12px}',
 '#mathasMultiCertified .mul-proof-grid{display:grid;gap:4px;align-items:center;width:max-content}',
 '#mathasMultiCertified .mul-proof-digit{min-width:34px;height:37px;display:flex;align-items:center;justify-content:center;',
 'font-weight:800;font-size:20px;font-variant-numeric:tabular-nums}',
 '#mathasMultiCertified input.mul-proof-input{width:34px;height:38px;text-align:center;padding:0;font-size:20px;',
 'border:2px solid #6997b5;border-radius:7px;color:white;background:#15445e;font-weight:800}',
 '#mathasMultiCertified input.mul-proof-input.carry{width:28px;height:29px;margin:auto;',
 'background:#534221;border-color:#efc278;color:#ffe8af;font-size:15px}',
 '#mathasMultiCertified input:focus{outline:3px solid #f5cb61;outline-offset:1px}',
 '#mathasMultiCertified .mul-proof-pad{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}',
 '#mathasMultiCertified button{background:#245875;color:white;border:1px solid #8daaba;',
 'border-radius:9px;padding:10px;font:700 15px system-ui;min-height:40px;cursor:pointer}',
 '#mathasMultiCertified button:disabled{opacity:.5;cursor:wait}',
 '#mathasMultiCertified .mul-proof-pad button{min-width:38px}',
 '#mathasMultiCertified .mul-proof-status{min-height:24px;font-weight:750;text-align:center;color:#fff0b8}',
 '#mathasMultiCertified .mul-proof-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}',
 '#mathasMultiCertified #mulProofVerify{background:#1b7157}',
 '@media(max-width:500px){#mathasMultiCertified{inset:2vh 2vw;padding:9px}',
 '#mathasMultiCertified .mul-proof-grid{gap:2px}',
 '#mathasMultiCertified .mul-proof-digit,#mathasMultiCertified input.mul-proof-input{width:30px;min-width:30px}',
 '#mathasMultiCertified .mul-proof-pad button{padding:8px;min-width:33px}}'
].join('\n');

export function createCertifiedMultiplicationClassic({
 documentRef=document,storage=localStorage,getContext,call,refresh,onVerified,notify
}){
 const doc=documentRef;
 let run=null,queue=null,sending=false,starting=false,requestSeq=0,activeInput=null,fields=[],carries=[];
 const root=doc.createElement('section');root.id='mathasMultiCertified';root.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
 root.setAttribute('aria-label','Multiplication écrite certifiée');
 const title=doc.createElement('h2'),label=doc.createElement('div'),
  status=doc.createElement('div'),board=doc.createElement('div'),pad=doc.createElement('div'),
  actions=doc.createElement('div');
 label.className='mul-proof-note';status.className='mul-proof-status';pad.className='mul-proof-pad';
 actions.className='mul-proof-actions';board.className='mul-proof-board';
 const header=doc.createElement('div');header.className='mul-proof-bar';
 const close=doc.createElement('button');close.type='button';close.textContent='Fermer';
 header.append(title,close);
 const verify=doc.createElement('button');verify.type='button';verify.id='mulProofVerify';
 verify.textContent='Vérifier ce calcul';
 const next=doc.createElement('button');next.type='button';next.textContent='Calcul suivant';next.hidden=true;
 actions.append(verify,next);root.append(header,label,board,pad,status,actions);
 if(!doc.getElementById('mathasMultiCertifiedStyle')){
  const style=doc.createElement('style');style.id='mathasMultiCertifiedStyle';
  style.textContent=CSS;doc.head.append(style);
 }
 doc.body.append(root);
 const current=()=>getContext();
 const live=()=>run&&run.owner===current().studentId&&run.cls===current().classId;
 const show=s=>{status.textContent=s;notify?.(s)};
 function reset(){
  requestSeq++;run=null;queue=null;sending=false;starting=false;root.hidden=true;board.replaceChildren();
 }
 function mountControls(){
  pad.replaceChildren();
  for(const digit of ['1','2','3','4','5','6','7','8','9','⌫','0']){
   const b=doc.createElement('button');b.type='button';b.textContent=digit;
   b.addEventListener('click',()=>{
    if(!activeInput||verify.disabled)return;
    activeInput.value=digit==='⌫'?'':digit;
    activeInput.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
    activeInput.focus();
   });pad.append(b);
  }
 }
 function cell(s=''){
  const el=doc.createElement('span');el.className='mul-proof-digit';el.textContent=s;return el;
 }
 function digitInput(kind,col){
  const input=doc.createElement('input');input.className='mul-proof-input '+kind;
  input.maxLength=1;input.type='text';input.inputMode='numeric';
  input.autocomplete='off';input.dataset.col=String(col);input.dataset.kind=kind;
  input.setAttribute('aria-label',kind==='carry'?'Report vers la colonne '+(col+1)
   :'Chiffre du produit, colonne '+(col+1));
  input.addEventListener('focus',()=>{activeInput=input});
  input.addEventListener('input',()=>{
   input.value=input.value.replace(/[^0-9]/g,'').slice(-1);
   if(!input.value||!live())return;
   const q=run.questions[run.answers.length];
   const carryExpected=j=>j>0&&j<q.a.length
    &&(BigInt(q.a)%(10n**BigInt(j))*BigInt(q.m))/(10n**BigInt(j))>0n;
   let target=null;
   if(kind==='carry')target=run.tensFirst?fields[col-1]:fields[col];
   else if(run.tensFirst){
    const next=col+2;
    target=carryExpected(next)&&!carries[next]?.value?carries[next]:fields[col+1];
   }else{
    const next=col+1;
    target=carryExpected(next)&&!carries[next]?.value?carries[next]:fields[next];
   }
   if(target&&!target.disabled)target.focus({preventScroll:true});
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();verify.click()}});
  return input;
 }
 function render(){
  if(!live())return;
  const index=run.answers.length,q=run.questions[index];
  if(!q){void finish();return}
  const product=(BigInt(q.a)*BigInt(q.m)).toString();
  const cols=product.length,rows=doc.createElement('div');
  rows.className='mul-proof-grid';rows.style.gridTemplateColumns='26px repeat('+cols+',34px)';
  fields=Array(cols).fill(null);carries=Array(q.a.length).fill(null);
  rows.append(cell('↗'));
  for(let j=cols-1;j>=0;j--){
   if(j===0||j>=q.a.length){rows.append(cell(''));continue}
   const input=digitInput('carry',j);carries[j]=input;rows.append(input);
  }
  rows.append(cell(''));
  for(const digit of q.a.padStart(cols,' '))rows.append(cell(digit.trim()));
  rows.append(cell('×'));
  for(let j=cols-1;j>=0;j--)rows.append(cell(j===0?String(q.m):''));
  rows.append(cell(''));
  for(let j=0;j<cols;j++)rows.append(cell('─'));
  rows.append(cell('='));
  for(let j=cols-1;j>=0;j--){
   const input=digitInput('answer',j);fields[j]=input;rows.append(input);
  }
  const top=doc.createElement('div');
  const carryOnTop=run.method==='top';
  top.textContent=carryOnTop?'Report au-dessus':'Report à côté : entre les retenues dans les petites cases.';
  top.className='mul-proof-note';
  board.replaceChildren(top,rows);
  const modeLabel=run.mode==='classic'?'Classique':run.mode==='three-lives'?'❤️ 3 vies':run.mode==='sudden'?'💀 Mort subite':run.mode==='hard-three-lives'?'🔥 HARD · 3 vies':'🔥 HARD · Mort subite';
  const state=multiplicationEndState(run.mode,run.answers,run.questions);
  title.textContent='✖ Multiplication · '+modeLabel+' · niveau '+run.level;
  label.textContent='Calcul '+(index+1)+'/'+run.total+(run.mode==='classic'?'':' · Réussites : '+state.correct+' · Vies : '+state.lives)+
   ' · Tables '+run.multipliers.join(', ')+
   '. Écris tous les chiffres (de droite à gauche) et les retenues.';
  status.textContent='Premier essai : toutes les cases comptent dans la vérification.';
  verify.disabled=false;verify.hidden=false;next.hidden=true;
  const power=10n;
  const needsCarry=Number((BigInt(q.a)%power*BigInt(q.m))/power)>0;
  (run.tensFirst&&needsCarry?carries[1]:fields[0])?.focus({preventScroll:true});
 }
 function getAnswer(){
  if(!live())return null;
  const q=run.questions[run.answers.length];
  if(!q||fields.some(x=>!x?.value))return null;
  return normalizeMultiplicationAttempt(q,{id:q.id,
   digits:fields.map(x=>x.value),carries:carries.map(x=>x?.value??'')});
 }
 function validate(){
  if(sending||!live()||run.finished)return;
  const answer=getAnswer();
  if(!answer){show('Complète tous les chiffres du résultat avant de vérifier.');return}
  const answers=[...run.answers,answer];
  if(!queue?.save(run,answers)){show('⚠️ Sauvegarde locale impossible : aucune preuve envoyée.');return}
  run.answers=answers;verify.disabled=true;
  const correct=multiplicationAttemptCorrect(run.questions[answers.length-1],answer);
  const expected=(BigInt(run.questions[answers.length-1].a)*BigInt(run.questions[answers.length-1].m)).toString();
  show(correct?'✅ Calcul juste.':'❌ Première réponse incorrecte. Produit attendu : '+expected);
  const end=multiplicationEndState(run.mode,run.answers,run.questions);
  if(!end.valid){show('⚠️ Preuve incohérente, aucun XP demandé.');return}
  if(end.complete){run.finished=true;void finish();return}
  next.hidden=false;
 }
 async function finish(){
  if(!live()||sending||!run||!multiplicationEndState(run.mode,run.answers,run.questions).complete)return;
  const ticket=run;sending=true;verify.disabled=true;next.hidden=true;
  show('Validation des premières réponses et des reports par Connect…');
  try{
   const ack=await call(ticket.mode==='classic'?'finish-classic-v1':'finish-extended-v1',
    {sessionId:ticket.sessionId,answers:ticket.answers});
   if(!live()||run!==ticket)return;
   const local=multiplicationEndState(ticket.mode,ticket.answers,ticket.questions).correct;
   if(ack?.proofVerified!==true||!isInt(ack.verifiedScore)||ack.verifiedScore!==local
    ||!isInt(ack.xp?.delta))throw Error('La certification du score ne correspond pas');
   queue?.clear();run=null;queue=null;board.replaceChildren();pad.replaceChildren();
   verify.hidden=true;next.hidden=true;
   label.textContent='Série certifiée · '+local+'/'+ticket.answers.length+
    ' · '+(ack.duplicate?'Réception précédente confirmée':('+'+ack.xp.delta+' XP Connect'));
   show('✅ Score vérifié par le serveur. Tu peux fermer cette fenêtre.');
   try{onVerified?.({eventId:ticket.sessionId,ack})}catch{/* optional consent */}
   try{await refresh()}catch{show('✅ Résultat certifié ; réactualise les XP quand le réseau revient.')}
  }catch(e){if(run===ticket){run.finished=true;
    show('⚠️ Preuve conservée. Clique « Réessayer la validation » : '+e.message);
    verify.textContent='Réessayer la validation';verify.disabled=false;verify.hidden=false;
   }}finally{sending=false}
 }
 async function start({mode='classic',level,total,multipliers,method='top',tensFirst=false}){
  const ctx=current();
  if(!ctx?.connected||!UUID.test(ctx.studentId)||!UUID.test(ctx.classId)
   ||run||starting||sending||!Object.hasOwn(WIDTHS,level)
   ||(mode==='classic'?!CLASSIC_COUNTS.includes(total):expectedMultiplicationWidth(mode,level)===null))return false;
  const selected=[...new Set(multipliers)].sort((a,b)=>a-b);
  if(!selected.length||selected.some(n=>!isInt(n)||n<2||n>9))return false;
  root.hidden=false;verify.hidden=true;next.hidden=true;verify.textContent='Vérifier ce calcul';
  status.textContent='Création de la série Connect…';starting=true;const seq=++requestSeq;
  try{
   const data=await call(mode==='classic'?'start-classic-v1':'start-extended-v1',
    mode==='classic'?{level,total,multipliers:selected}:{level,mode,multipliers:selected});
   const fresh=current();
   if(ctx.studentId!==fresh.studentId||ctx.classId!==fresh.classId||seq!==requestSeq)throw Error('Profil remplacé');
   const parsed=mode==='classic'?acceptMultiplicationChallenge(data,level,total,selected)
    :acceptMultiplicationExtendedChallenge(data,level,mode,selected);
   if(!parsed)throw Error('Opérations émises par le serveur invalides');
   queue=multiplicationQueue(storage,ctx.studentId,ctx.classId,mode,level);
   if(!queue)throw Error('Stockage de reprise indisponible');
   const previous=queue.read();
   let saved=[];
   if(previous?.sessionId===parsed.sessionId&&previous.level===level&&previous.total===parsed.total
    &&previous.answers.every((a,i)=>normalizeMultiplicationAttempt(parsed.questions[i],a)))
     saved=previous.answers;
   run={...parsed,mode,owner:ctx.studentId,cls:ctx.classId,multipliers:selected,
    method,tensFirst,answers:saved,finished:false};
   if(!queue.save(run,run.answers))throw Error('Sauvegarde du défi impossible');
   mountControls();
   const state=multiplicationEndState(mode,run.answers,run.questions);
   if(!state.valid)throw Error('Reprise de réponses incohérentes');
   if(state.complete){run.finished=true;void finish()}else render();
   return true;
  }catch(e){
   show('⚠️ Série certifiée indisponible : '+e.message);
   run=null;queue=null;verify.hidden=true;next.hidden=true;return false;
  }finally{starting=false}
 }
 verify.addEventListener('click',()=>{if(run?.finished)void finish();else validate()});
 next.addEventListener('click',()=>{if(run&&!run.finished)render()});
 close.addEventListener('click',()=>{if(sending)return;requestSeq++;root.hidden=true;run=null;queue=null;
  verify.textContent='Vérifier ce calcul';verify.hidden=false;notify?.('Série interrompue ; reprise possible avant expiration.')});
 return Object.freeze({start,reset,isOpen:()=>!root.hidden});
}
