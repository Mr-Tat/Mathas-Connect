// Injecté dans la fermeture du moteur V7 UNIQUEMENT pour le jeu Connect.
  // Ne modifie ni l'exercice individuel, ni les preuves scolaires, ni les XP.
  const mathasGuidedAnswers=new Map();
  const mathasGuidedBridge={
   active:false,pageIndex:-1,onContinue:null,
   isCollectiveActive(){return this.active;},
   getConfig(){return {level:Number($('trainingLevel').value),
    carryMethod:document.querySelector('input[name="carryMethod"]:checked')?.value||'top',
    multipliers:[...selectedMultipliers]};},
   status(){return{training:session?.mode==='training',collective:this.active,
    finished:session?.mode==='training'&&states.length===2&&states.every(s=>s.solved),
    pageIndex:this.pageIndex,phase};},
   isFinished(index){
    if(this.active&&this.pageIndex===index&&session?.mode==='training')return states.length===2&&states.every(v=>v.solved);
    const saved=mathasGuidedAnswers.get(index);
    return Array.isArray(saved)&&saved.length===2&&saved.every(v=>v.solved===true);
   },
   resetSaved(){mathasGuidedAnswers.clear();this.active=false;this.pageIndex=-1;},
   save(){
    if(!this.active||this.pageIndex<0||session?.mode!=='training')return;
    mathasGuidedAnswers.set(this.pageIndex,states.map(s=>({
     answerValues:[...s.answerValues],carryValues:[...s.carryValues],
     sideCarryValues:[...s.sideCarryValues],wrongHistory:[...s.wrongHistory],
     carryWrong:[...s.carryWrong],firstTry:s.firstTry,solved:s.solved
    })));
   },
   enter(page,index,config){
    if(![1,2,3].includes(config?.level)||!['top','side'].includes(config?.carryMethod))return false;
    this.save();$('trainingLevel').value=String(config.level);
    const method=document.querySelector('input[name="carryMethod"][value="'+config.carryMethod+'"]');
    if(method)method.checked=true;
    startSession('training');
    this.active=true;this.pageIndex=-1;
    return this.show(page,index);
   },
   show(page,index){
    if(!this.active||session?.mode!=='training'||!Number.isInteger(index)||index<0
     ||!Array.isArray(page)||page.length!==2||!page.every(x=>
       typeof x?.a==='string'&&/^[1-9][0-9]{1,6}$/.test(x.a)
       &&Number.isInteger(x.m)&&x.m>=2&&x.m<=9))return false;
    this.save();
    const old=mathasGuidedAnswers.get(index);
    const makeFixed=({a,m})=>{
      const result=(BigInt(a)*BigInt(m)).toString(),count=a.length,answerCount=result.length;
      const incoming=Array(count).fill(0),outgoing=Array(count).fill(0);
      let carry=0;
      for(let i=0;i<count;i++){
       incoming[i]=carry;carry=Math.floor((Number(a[count-1-i])*m+carry)/10);
       outgoing[i]=carry;
      }
      return{a,m,result,count,answerCount,incoming,outgoing,
       answerValues:Array(answerCount).fill(''),carryValues:Array(count).fill(''),
       sideCarryValues:Array(count).fill(''),wrongHistory:Array(answerCount).fill(''),
       carryWrong:Array(count).fill(''),firstTry:true,solved:false};
    };
    this.pageIndex=index;states=page.map(makeFixed);
    if(Array.isArray(old)&&old.length===2)for(let i=0;i<2;i++){
     for(const key of ['answerValues','carryValues','sideCarryValues','wrongHistory','carryWrong'])
      if(Array.isArray(old[i][key])&&old[i][key].length===states[i][key].length)
       states[i][key]=[...old[i][key]];
     states[i].firstTry=old[i].firstTry!==false;
     states[i].solved=old[i].solved===true;
    }
    clearMultiplicationHint();hintBtn._step=0;hintBtn._key=null;
    session.completed=index*2;
    active={kind:'answer',calc:0,col:0};calculationsPair.innerHTML='';
    states.forEach((s,i)=>renderCalc(s,i));
    for(let i=0;i<2;i++){
     const s=states[i],box=calculationsPair.querySelector('.calc-box[data-calc="'+i+'"]');
     if(!box)continue;
     box.querySelectorAll('.answer-input').forEach(el=>{
      const c=Number(el.dataset.col);
      el.value=s.answerValues[c]||'';
      if(el.value&&s.solved)el.classList.add('correct');
      const history=el.closest('.answer-wrap')?.querySelector('.wrong-history');
      if(history)history.textContent=s.wrongHistory[c]||'';
     });
     box.querySelectorAll('.carry-input').forEach(el=>{
      const c=Number(el.dataset.carryCol);
      el.value=s.carryValues[c]||'';
      if(el.value)el.classList.add('good');
      const history=el.closest('.carry-wrap')?.querySelector('.carry-wrong');
      if(history)history.textContent=s.carryWrong[c]||'';
     });
     const side=box.querySelector('.side-carry-panel');
     const used=side?.querySelector('.side-carry-used-list');
     if(used)for(let c=1;c<s.count;c++){
      if(s.sideCarryValues[c]===String(s.incoming[c])&&s.sideCarryValues[c]!==''){
       const item=document.createElement('span');
       item.className='side-carry-used-item';item.dataset.usedCol=String(c);
       item.textContent=s.sideCarryValues[c];used.append(item);
      }
     }
     if(s.solved){
      box.querySelectorAll('input').forEach(el=>{el.disabled=true;if(el.value)el.classList.add('correct','good')});
      status(i,'Correct','ok');
     }
    }
    const solved=states.filter(s=>s.solved).length;
    session.completed+=solved;
    if(!states[0].solved)mathasGateSecondCalc(true);
    else mathasGateSecondCalc(false);
    phase=solved===2?'review':'answering';
    primaryBtn.textContent=solved===2?'Suivant (classe)':'Valider';
    resetBtn.disabled=solved===2;
    hintBtn.classList.remove('hidden');hintBtn.textContent='🧭 Guide';
    updateInstruction();updateBar();setFeedback('','');
    if(solved!==2)focusMulColumn(states[0].solved?1:0,0);
    updateSecondDim();requestAnimationFrame(updateScrollArrow);
    return true;
   },
   practice(){this.save();this.active=false;this.pageIndex=-1;startSession('training');},
   leave(){this.save();this.active=false;this.pageIndex=-1;}
  };
  window.MathasGuidedBridge=mathasGuidedBridge;
