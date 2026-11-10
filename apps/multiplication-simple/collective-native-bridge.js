// Injecté dans la fermeture du moteur V7 UNIQUEMENT pour le jeu Connect.
  // Ne modifie ni l'exercice individuel, ni les preuves scolaires, ni les XP.
  const mathasGuidedAnswers=new Map();
  const mathasGuidedPageSpecs=new Map();
  const mathasGuidedBridge={
   active:false,pageIndex:-1,onContinue:null,currentSessionId:null,
   isCollectiveActive(){return this.active;},
   useSession(sessionId){
    if(!sessionId||sessionId===this.currentSessionId)return;
    // Une nouvelle séance collective n'hérite jamais des réponses d'une autre séance.
    mathasGuidedAnswers.clear();mathasGuidedPageSpecs.clear();
    this.currentSessionId=sessionId;this.active=false;this.pageIndex=-1;
   },
   finishedAt(index){
    if(!Number.isInteger(index)||index<0)return false;
    if(this.active&&this.pageIndex===index&&session?.mode==='training')
     return states.length===2&&states.every(s=>s.solved);
    const saved=mathasGuidedAnswers.get(index);
    return Array.isArray(saved)&&saved.length===2&&saved.every(s=>s.solved===true);
   },
   getConfig(){return {level:Number($('trainingLevel').value),
    carryMethod:document.querySelector('input[name="carryMethod"]:checked')?.value||'top',
    multipliers:[...selectedMultipliers]};},
   status(){return{training:session?.mode==='training',collective:this.active,
    finished:session?.mode==='training'&&states.length===2&&states.every(s=>s.solved),
    pageIndex:this.pageIndex,phase};},
   save(){
    if(!this.active||this.pageIndex<0||session?.mode!=='training')return;
    mathasGuidedAnswers.set(this.pageIndex,states.map(s=>({
     answerValues:[...s.answerValues],carryValues:[...s.carryValues],
     sideCarryValues:[...s.sideCarryValues],wrongHistory:[...s.wrongHistory],
     carryWrong:[...s.carryWrong],firstTry:s.firstTry,solved:s.solved
    })));
   },
   // Capture tous les états pédagogiques du guidé, pas ceux de l'entraînement libre.
   // Les pages et leur ordre proviennent du serveur lors du retour en séance.
   snapshot(){
    this.save();
    return [...mathasGuidedAnswers.entries()].map(([index,parts])=>({
     index,operations:mathasGuidedPageSpecs.get(index),
     states:parts.map(part=>({
      answerValues:[...part.answerValues],carryValues:[...part.carryValues],
      sideCarryValues:[...part.sideCarryValues],wrongHistory:[...part.wrongHistory],
      carryWrong:[...part.carryWrong],firstTry:part.firstTry,solved:part.solved
     }))
    })).filter(item=>Array.isArray(item.operations));
   },
   restoreSnapshot(items,serverSession){
    if(this.currentSessionId!==serverSession?.sessionId||!Array.isArray(items)||items.length>120
      ||!Array.isArray(serverSession.pages)||!['top','side'].includes(serverSession.carryMethod))return 0;
    let restored=0;
    const digitArray=(value,size)=>{
     if(!Array.isArray(value)||value.length!==size)return null;
     return value.every(v=>typeof v==='string'&&/^[0-9]?$/.test(v))?[...value]:null;
    };
    for(const item of items){
     const index=item?.index,page=serverSession.pages[index];
     if(!Number.isInteger(index)||index<0||!Array.isArray(page)||page.length!==2
       ||mathasGuidedAnswers.has(index)||!Array.isArray(item.operations)
       ||item.operations.length!==2||!Array.isArray(item.states)||item.states.length!==2
       ||!page.every((op,i)=>item.operations[i]?.a===op.a&&item.operations[i]?.m===op.m))continue;
     const statesToRestore=[];
     for(let i=0;i<2;i++){
      const {a,m}=page[i],part=item.states[i],answer=(BigInt(a)*BigInt(m)).toString();
      if(!part||typeof part!=='object'){statesToRestore.length=0;break}
      const size=a.length,cols=answer.length;
      const answerValues=digitArray(part.answerValues,cols);
      const carryValues=digitArray(part.carryValues,size);
      const sideCarryValues=digitArray(part.sideCarryValues,size);
      const wrongHistory=digitArray(part.wrongHistory,cols);
      const carryWrong=digitArray(part.carryWrong,size);
      if(!answerValues||!carryValues||!sideCarryValues||!wrongHistory||!carryWrong){
       statesToRestore.length=0;break;
      }
      let carry=0,carryOk=true;
      for(let c=0;c<size;c++){
       const expected=c>=1&&carry>0?String(carry):'';
       const raw=serverSession.carryMethod==='top'?carryValues[c]:sideCarryValues[c];
       if(c>=1&&raw!==''&&raw!==expected&&!(expected===''&&raw==='0'))carryOk=false;
       carry=Math.floor((Number(a[size-1-c])*m+carry)/10);
      }
      // Ne restaurer « réussi » que si les chiffres restent réellement justes.
      const answerOk=answerValues.every((v,c)=>v===answer[answer.length-1-c]);
      statesToRestore.push({answerValues,carryValues,sideCarryValues,wrongHistory,
       carryWrong,firstTry:part.firstTry!==false,
       solved:part.solved===true&&answerOk&&carryOk});
     }
     if(statesToRestore.length!==2)continue;
     mathasGuidedAnswers.set(index,statesToRestore);
     mathasGuidedPageSpecs.set(index,page.map(({a,m})=>({a,m})));
     restored++;
    }
    return restored;
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
    mathasGuidedPageSpecs.set(index,page.map(({a,m})=>({a,m})));
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
     // Les reports latéraux et les traces de corrections doivent eux aussi
     // revenir visuellement, pas seulement rester dans l'état interne.
     const used=box.querySelector('.side-carry-used-list');
     if(used)for(let c=1;c<s.count;c++){
      if(s.sideCarryValues[c]===String(s.incoming[c])&&s.sideCarryValues[c]!==''){
       const tag=document.createElement('span');
       tag.className='side-carry-used-item';tag.dataset.usedCol=String(c);
       tag.textContent=s.sideCarryValues[c];used.append(tag);
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
