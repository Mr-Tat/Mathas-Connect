// Pont du guidé collectif dans la fermeture du moteur Soustraction natif.
// Injection uniquement Connect ; aucune écriture scolaire/XP/trophée.
const mathasGuidedAnswers=new Map(),mathasGuidedSpecs=new Map();
const mathasGuidedBridge={
 active:false,pageIndex:-1,onContinue:null,currentSessionId:null,
 isCollectiveActive(){return this.active},
 useSession(id){
  if(!id||id===this.currentSessionId)return;
  mathasGuidedAnswers.clear();mathasGuidedSpecs.clear();
  this.currentSessionId=id;this.active=false;this.pageIndex=-1;
 },
 validOperation(op){
  return typeof op?.a==='string'&&/^[1-9][0-9]{0,6}$/.test(op.a)
   &&typeof op?.b==='string'&&/^[1-9][0-9]{0,6}$/.test(op.b)
   &&BigInt(op.a)>BigInt(op.b);
 },
 fixed(op){
  if(!this.validOperation(op))return null;
  const top=Number(op.a),bottom=Number(op.b),count=op.a.length,result=top-bottom;
  return {count,top,bottom,result,answerCount:count,bottomLength:op.b.length,
   topDigits:digitsRTL(top,count),bottomDigits:digitsRTL(bottom,count),
   borrowed:Array(count).fill(false),carry:Array(count).fill(0),
   adjustValues:Array(count).fill(''),adjustExpected:Array(count).fill(null),
   wrongHistory:Array(count).fill(''),answerValues:Array(count).fill(''),
   firstTry:true,solved:false};
 },
 getConfig(){
  const n=Number(trainingMaxDigits.value),level=n===3?1:n===5?2:n===7?3:0;
  return {level,borrowMethod:selectedBorrowMethod()};
 },
 status(){return {training:session?.mode==='training',collective:this.active,
  pageIndex:this.pageIndex,phase,finished:states?.length===2&&states.every(s=>s.solved)}},
 finishedAt(index){
  if(this.active&&index===this.pageIndex&&session?.mode==='training')
   return states.length===2&&states.every(s=>s.solved===true);
  const saved=mathasGuidedAnswers.get(index);
  return Array.isArray(saved)&&saved.length===2&&saved.every(s=>s.solved===true);
 },
 save(){
  if(!this.active||this.pageIndex<0||session?.mode!=='training')return;
  mathasGuidedAnswers.set(this.pageIndex,states.map((s,i)=>({
   answerValues:Array.from({length:s.count},(_,c)=>inputFor(i,c)?.value||''),
   borrowed:[...s.borrowed],carry:[...s.carry],
   adjustValues:[...s.adjustValues],adjustExpected:[...s.adjustExpected],
   wrongHistory:[...s.wrongHistory],firstTry:s.firstTry!==false,solved:s.solved===true
  })));
 },
 snapshot(){
  this.save();
  return [...mathasGuidedAnswers].map(([index,parts])=>({
   index,operations:mathasGuidedSpecs.get(index),
   states:parts.map(s=>({...s,answerValues:[...s.answerValues],borrowed:[...s.borrowed],
    carry:[...s.carry],adjustValues:[...s.adjustValues],
    adjustExpected:[...s.adjustExpected],wrongHistory:[...s.wrongHistory]}))
  })).filter(item=>Array.isArray(item.operations));
 },
 restoreSnapshot(entries,serverSession){
  if(!serverSession||this.currentSessionId!==serverSession.sessionId
    ||!Array.isArray(entries)||entries.length>120
    ||!Array.isArray(serverSession.pages)||!['addBottom','takeTop'].includes(serverSession.borrowMethod))return 0;
  const digits=(v,n)=>Array.isArray(v)&&v.length===n
   &&v.every(x=>typeof x==='string'&&/^[0-9]?$/.test(x))?[...v]:null;
  let restored=0;
  for(const item of entries){
   const index=item?.index,page=serverSession.pages[index];
   if(!Number.isInteger(index)||index<0||!Array.isArray(page)||page.length!==2
    ||!Array.isArray(item.operations)||item.operations.length!==2
    ||!page.every((op,i)=>this.validOperation(op)
      &&item.operations[i]?.a===op.a&&item.operations[i]?.b===op.b)
    ||!Array.isArray(item.states)||item.states.length!==2||mathasGuidedAnswers.has(index))continue;
   const copy=[];
   for(let i=0;i<2;i++){
    const src=item.states[i],fixed=this.fixed(page[i]),n=fixed.count;
    const answerValues=digits(src?.answerValues,n),adjustValues=digits(src?.adjustValues,n),
     wrongHistory=digits(src?.wrongHistory,n);
    if(!answerValues||!adjustValues||!wrongHistory
      ||!Array.isArray(src.borrowed)||src.borrowed.length!==n
      ||!src.borrowed.every(x=>typeof x==='boolean')
      ||!Array.isArray(src.carry)||src.carry.length!==n
      ||!src.carry.every((x,c)=>x===(c===0?0:(src.borrowed[c-1]?1:0)))
      ||!Array.isArray(src.adjustExpected)||src.adjustExpected.length!==n
      ||!src.adjustExpected.every(x=>x===null||(Number.isInteger(x)&&x>=0&&x<=19))){copy.length=0;break}
    const answer=String(fixed.result).padStart(n,'0').split('').reverse();
    const correct=answerValues.every((v,c)=>v===answer[c]);
    copy.push({answerValues,borrowed:[...src.borrowed],carry:[...src.carry],
     adjustValues,adjustExpected:[...src.adjustExpected],wrongHistory,
     firstTry:src.firstTry!==false,solved:src.solved===true&&correct});
   }
   if(copy.length!==2)continue;
   mathasGuidedAnswers.set(index,copy);
   mathasGuidedSpecs.set(index,page.map(({a,b})=>({a,b})));
   restored++;
  }
  return restored;
 },
 enter(page,index,config){
  if(![1,2,3].includes(config?.level)||!['addBottom','takeTop'].includes(config.borrowMethod))return false;
  this.save();
  trainingMaxDigits.value=String([3,5,7][config.level-1]);
  const technique=document.querySelector('input[name="borrowMethod"][value="'+config.borrowMethod+'"]');
  if(technique)technique.checked=true;
  startSession('training');this.active=true;this.pageIndex=-1;
  return this.show(page,index);
 },
 show(page,index){
  if(!this.active||session?.mode!=='training'||!Number.isInteger(index)||index<0
   ||!Array.isArray(page)||page.length!==2||!page.every(x=>this.validOperation(x)))return false;
  this.save();
  const previous=mathasGuidedAnswers.get(index),next=page.map(op=>this.fixed(op));
  if(Array.isArray(previous)&&previous.length===2)for(let i=0;i<2;i++){
   const old=previous[i],now=next[i];
   for(const key of ['answerValues','borrowed','carry','adjustValues','adjustExpected','wrongHistory'])
    if(Array.isArray(old[key])&&old[key].length===now[key].length)now[key]=[...old[key]];
   now.firstTry=old.firstTry!==false;now.solved=old.solved===true;
  }
  mathasGuidedSpecs.set(index,page.map(({a,b})=>({a,b})));
  this.pageIndex=index;states=next;
  session.completed=index*2;
  active={kind:'answer',calc:0,col:0,replace:false};
  calculationsPair.innerHTML='';states.forEach((s,i)=>renderCalc(s,i));
  for(let i=0;i<2;i++){
   const s=states[i],op=opFor(i),box=calculationsPair.querySelector('.calc-box[data-calc="'+i+'"]');
   if(!op||!box)continue;
   op.querySelectorAll('.answer-input').forEach(inp=>{
    const c=Number(inp.dataset.col);inp.value=s.answerValues[c]||'';
    const hist=op.querySelector('[data-history="'+c+'"]');
    if(hist)hist.textContent=s.wrongHistory[c]||'';
   });
   refreshBorrowDisplay(i);
   if(s.solved){
    box.querySelectorAll('input,button').forEach(node=>{
     node.disabled=true;if(node.value)node.classList.add('correct','good')
    });
    status(i,'Correct','ok');
    mathasGateSecondCalc(i===0?false:!states[0].solved);
   }
  }
  mathasGateSecondCalc(!states[0].solved);
  session.completed+=states.filter(s=>s.solved).length;
  phase=states.every(s=>s.solved)?'review':'answering';
  setPrimaryActionLabel(phase==='review'?'Suivant (classe)':'Valider');
  resetBtn.disabled=phase==='review';setNumpadDisabled(phase==='review');
  hintBtn.classList.remove('hidden');hintBtn.textContent='🧭 Guide';
  updateBar();setFeedback('','');
  if(phase!=='review')focusInput(states[0].solved?1:0,0);
  return true;
 },
 practice(){this.save();this.active=false;this.pageIndex=-1;startSession('training')},
 leave(){this.save();this.active=false;this.pageIndex=-1}
};
window.MathasGuidedBridge=mathasGuidedBridge;
