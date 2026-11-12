// Injecté DANS la fermeture native du moteur Addition multiple, seulement en mode Connect.
// L'hôte vérifie un marqueur exact avant insertion ; pas d'injection dans les autres modes.
const mathasGuidedAnswers=new Map(), mathasGuidedSpecs=new Map();
const mathasGuidedBridge={
 active:false,pageIndex:-1,onContinue:null,currentSessionId:null,
 isCollectiveActive(){return this.active},
 useSession(id){
  if(!id||id===this.currentSessionId)return;
  mathasGuidedAnswers.clear();mathasGuidedSpecs.clear();
  this.currentSessionId=id;this.active=false;this.pageIndex=-1;
 },
 validOperation(op){
  return Array.isArray(op?.addends)&&op.addends.length>=3&&op.addends.length<=5
   &&op.addends.every(n=>typeof n==='string'&&/^[1-9][0-9]{0,6}$/.test(n));
 },
 fixed(op){
  if(!this.validOperation(op))return null;
  const addends=op.addends.map(Number),result=addends.reduce((a,b)=>a+b,0);
  const count=Math.max(...op.addends.map(n=>n.length)),answerCount=String(result).length;
  const incoming=Array(count).fill(0),outgoing=Array(count).fill(0);let carry=0;
  for(let i=0;i<count;i++){
   incoming[i]=carry;
   let sum=carry;
   for(const n of addends)sum+=Math.floor(n/10**i)%10;
   carry=Math.floor(sum/10);outgoing[i]=carry;
  }
  return {addends,addendCount:addends.length,result,count,answerCount,
   carryExpected:incoming,outgoing,answerValues:Array(answerCount).fill(''),
   carryValues:Array(count).fill(''),wrongHistory:Array(answerCount).fill(''),
   carryWrong:Array(count).fill(''),firstTry:true,solved:false};
 },
 getConfig(){
  const maxDigits=Number(trainingMaxDigits.value);
  return {level:maxDigits===5?1:maxDigits===6?2:maxDigits===7?3:0};
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
  mathasGuidedAnswers.set(this.pageIndex,states.map(s=>({
   answerValues:[...s.answerValues],carryValues:[...s.carryValues],
   wrongHistory:[...s.wrongHistory],carryWrong:[...s.carryWrong],
   firstTry:s.firstTry!==false,solved:s.solved===true
  })));
 },
 snapshot(){
  this.save();
  return [...mathasGuidedAnswers].map(([index,states])=>({
   index,operations:mathasGuidedSpecs.get(index),
   states:states.map(s=>({...s,answerValues:[...s.answerValues],carryValues:[...s.carryValues],
    wrongHistory:[...s.wrongHistory],carryWrong:[...s.carryWrong]}))
  })).filter(x=>Array.isArray(x.operations));
 },
 restoreSnapshot(entries,serverSession){
  if(!serverSession||this.currentSessionId!==serverSession.sessionId
    ||!Array.isArray(entries)||entries.length>120||!Array.isArray(serverSession.pages))return 0;
  const digits=(arr,n)=>Array.isArray(arr)&&arr.length===n
   &&arr.every(v=>typeof v==='string'&&/^[0-9]?$/.test(v))?[...arr]:null;
  let restored=0;
  for(const entry of entries){
   const index=entry?.index,page=serverSession.pages[index];
   if(!Number.isInteger(index)||index<0||!Array.isArray(page)||page.length!==2
     ||!Array.isArray(entry.operations)||entry.operations.length!==2
     ||!page.every((op,i)=>this.validOperation(op)
       &&Array.isArray(entry.operations[i]?.addends)
       &&entry.operations[i].addends.length===op.addends.length
       &&entry.operations[i].addends.every((value,j)=>value===op.addends[j]))
     ||!Array.isArray(entry.states)||entry.states.length!==2
     ||mathasGuidedAnswers.has(index))continue;
   const fixed=page.map(op=>this.fixed(op)),saved=[];
   for(let i=0;i<2;i++){
    const p=entry.states[i],f=fixed[i];
    const answerValues=digits(p?.answerValues,f.answerCount),
     carryValues=digits(p?.carryValues,f.count),
     wrongHistory=digits(p?.wrongHistory,f.answerCount),
     carryWrong=digits(p?.carryWrong,f.count);
    if(!answerValues||!carryValues||!wrongHistory||!carryWrong){saved.length=0;break}
    const correctAnswer=answerValues.every((v,c)=>v===String(f.result).split('').reverse()[c]);
    const validCarries=carryValues.every((v,c)=>{
     if(c===0)return v==='';
     const expected=f.carryExpected[c]>0?String(f.carryExpected[c]):'';
     return v===expected||(expected===''&&v==='0');
    });
    saved.push({answerValues,carryValues,wrongHistory,carryWrong,
     firstTry:p.firstTry!==false,solved:p.solved===true&&correctAnswer&&validCarries});
   }
   if(saved.length!==2)continue;
   mathasGuidedAnswers.set(index,saved);
   mathasGuidedSpecs.set(index,page.map(({addends})=>({addends:[...addends]})));
   restored++;
  }
  return restored;
 },
 enter(page,index,config){
  if(![1,2,3].includes(config?.level))return false;
  this.save();
  trainingMaxDigits.value=String([5,6,7][config.level-1]);
  startSession('training');this.active=true;this.pageIndex=-1;
  return this.show(page,index);
 },
 show(page,index){
  if(!this.active||session?.mode!=='training'||!Number.isInteger(index)||index<0
    ||!Array.isArray(page)||page.length!==2||!page.every(x=>this.validOperation(x)
      &&x.addends.length===([3,4,5][session.level-1])))return false;
  this.save();
  const previous=mathasGuidedAnswers.get(index);
  const next=page.map(op=>this.fixed(op));
  if(Array.isArray(previous)&&previous.length===2)for(let i=0;i<2;i++){
   const old=previous[i],now=next[i];
   for(const key of ['answerValues','carryValues','wrongHistory','carryWrong'])
    if(Array.isArray(old[key])&&old[key].length===now[key].length)now[key]=[...old[key]];
   now.firstTry=old.firstTry!==false;now.solved=old.solved===true;
  }
  mathasGuidedSpecs.set(index,page.map(({addends})=>({addends:[...addends]})));
  this.pageIndex=index;states=next;
  session.completed=index*2+states.filter(s=>s.solved).length;
  active={kind:'answer',calc:0,col:0};
  calculationsPair.innerHTML='';states.forEach((s,i)=>renderCalc(s,i));
  for(let i=0;i<2;i++){
   const s=states[i],box=calculationsPair.querySelector('.calc-box[data-calc="'+i+'"]');
   if(!box)continue;
   box.querySelectorAll('.answer-input').forEach(inp=>{
    const c=Number(inp.dataset.col);inp.value=s.answerValues[c]||'';
    const history=inp.closest('.answer-wrap')?.querySelector('.wrong-history');
    if(history)history.textContent=s.wrongHistory[c]||'';
   });
   box.querySelectorAll('.carry-input').forEach(inp=>{
    const c=Number(inp.dataset.carryCol);inp.value=s.carryValues[c]||'';
    if(inp.value)inp.classList.add('filled');
    const history=inp.closest('.carry-wrap')?.querySelector('.carry-wrong');
    if(history)history.textContent=s.carryWrong[c]||'';
   });
   if(s.solved){
    box.querySelectorAll('input').forEach(inp=>{
     inp.disabled=true;if(inp.value)inp.classList.add('correct','good')
    });
    status(i,'Correct','ok');
   }
  }
  phase=states.every(s=>s.solved)?'review':'answering';
  setPrimaryLabel(phase==='review'?'Suivant (classe)':'Valider');
  resetBtn.disabled=phase==='review';
  hintBtn.classList.remove('hidden');hintBtn.textContent='🧭 Guide';
  updateInstruction();updateBar();setFeedback('','');
  if(phase!=='review')focusColumnStart(states[0].solved?1:0,0);
  return true;
 },
 practice(){this.save();this.active=false;this.pageIndex=-1;startSession('training')},
 leave(){this.save();this.active=false;this.pageIndex=-1}
};
window.MathasGuidedBridge=mathasGuidedBridge;
