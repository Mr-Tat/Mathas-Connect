// Adaptateur non destructif : toutes les grilles, saisies et animations restent
// celles du moteur V7. Seuls les opérandes émis et les premiers essais sont
// reliés à une preuve SQL. N'est injecté QUE dans une session Connect.
const ENTRY=String.raw\`
  // Adaptateur scolaire injecté dans la fermeture du moteur natif.
  function mathasProofCapture(s){
    if(!proofFeed?.active||!s?.__schoolProofId||s.__schoolProofCaptured)return true;
    const digits=s.answerValues.map(v=>String(v??''));
    const carries=(carryMethod==='side'?s.sideCarryValues:s.carryValues)
      .map(v=>String(v??''));
    const accepted=proofFeed.receiver.record({id:s.__schoolProofId,digits,carries});
    if(accepted)s.__schoolProofCaptured=true;
    return accepted;
  }
  function mathasProofHardCapture(){
    if(!proofFeed?.active||!hardState?.__schoolProofId||hardState.__schoolProofCaptured)return true;
    const digits=hardState.answerValues.map(v=>String(v??''));
    const carries=(carryMethod==='side'?hardState.sideCarryValues:hardState.carryValues)
      .map(v=>String(v??''));
    const accepted=proofFeed.receiver.record({id:hardState.__schoolProofId,digits,carries});
    if(accepted)hardState.__schoolProofCaptured=true;
    return accepted;
  }
  window.MathasNativeCertifiedBridge=Object.freeze({
    launch(run,receiver){
      if(!run||!receiver||!Array.isArray(run.questions)||!Array.isArray(run.answers)
        ||!['classic','sudden','three-lives','hard-sudden','hard-three-lives'].includes(run.mode)
        ||![1,2,3].includes(run.level)||!['top','side'].includes(run.method))
        return false;
      const prior=run.answers.length;
      const state=receiver.progress();
      if(!state?.valid||state.complete)return false;
      if(proofFeed?.active)return false;
      const hard=run.mode.startsWith('hard-');
      const cursor=!hard&&prior%2===1?prior-1:prior;
      proofFeed={run,receiver,active:true,cursor,done:false};
      carryMethod=run.method;
      tensFirst=!!run.tensFirst;
      window.__mathasTensFirst=tensFirst;
      const carryOption=document.querySelector('input[name="carryMethod"][value="'+carryMethod+'"]');
      if(carryOption)carryOption.checked=true;
      if(tensFirstToggle)tensFirstToggle.checked=tensFirst;
      if(Array.isArray(run.multipliers)&&run.multipliers.length){
        selectedMultipliers=new Set(run.multipliers);syncMultiplierUI();
      }
      try{
        if(hard){
          const spec=HARD.find(x=>x.level===run.level);
          if(!spec)throw Error('Niveau HARD manquant');
          const master=window.__masterMode;
          window.__masterMode=true; // défi déjà autorisé par le serveur
          try{startHard(spec,'sudden')}finally{window.__masterMode=master}
          if(!hardSession)throw Error('HARD non initialisé');
          hardSession.score=state.correct;
          hardSession.completed=prior;
          updateHardHeader();
        }else{
          document.getElementById(run.mode==='classic'?'classicLevel':'suddenLevel').value=String(run.level);
          if(run.mode==='classic'){selectedCount=run.total;syncCountUI()}
          startSession(run.mode==='classic'?'classic':'sudden');
          if(!session)throw Error('Session native non initialisée');
          session.score=state.correct;
          session.completed=prior;
          if(prior%2===1){
            // La première opération de la paire a déjà été enregistrée sur
            // l'appareil. Elle reste visible, marquée comme terminée.
            states[0].__schoolProofCaptured=true;
            states[0].firstTry=false;
            lockCalc(0);
            status(0,'Déjà validé avant la reprise','ok');
          }
          updateBar();
        }
        return true;
      }catch(e){
        proofFeed=null;
        receiver.problem?.('Reprise native impossible : '+e.message);
        return false;
      }
    },
    completed(){
      if(proofFeed)proofFeed.done=true;
    },
    active:()=>!!proofFeed?.active,
    abandonView(){if(proofFeed){proofFeed.active=false;proofFeed=null}}
  });
\`;
export function injectNativeMultiplicationProof(html){
 if(typeof html!=='string')throw Error('native_game_missing');
 const changes=[
  ["let session=null,states=[],active={kind:'answer',calc:0,col:0},phase='menu',tablesOpen=false;",
   "let session=null,states=[],active={kind:'answer',calc:0,col:0},phase='menu',tablesOpen=false;\n  let proofFeed=null;"],
  ["const a=randomString(exact?maxDigits:chooseLen(maxDigits)),m=chooseMultiplier(mults),result=(BigInt(a)*BigInt(m)).toString(),count=a.length,answerCount=result.length;",
   "const proof=proofFeed?.active?proofFeed.run.questions[proofFeed.cursor]:null;\n    if(proofFeed?.active&&!proof)throw Error('Défi serveur épuisé : ne pas produire de calcul non certifié');\n    if(proof)proofFeed.cursor++;\n    const a=proof?proof.a:randomString(exact?maxDigits:chooseLen(maxDigits)),m=proof?proof.m:chooseMultiplier(mults),result=(BigInt(a)*BigInt(m)).toString(),count=a.length,answerCount=result.length;"],
  ["return{a,m,result,count,answerCount,incoming,outgoing,answerValues:Array(answerCount).fill(''),carryValues:Array(count).fill(''),sideCarryValues:Array(count).fill(''),wrongHistory:Array(answerCount).fill(''),carryWrong:Array(count).fill(''),firstTry:true,solved:false}",
   "return{a,m,result,count,answerCount,incoming,outgoing,answerValues:Array(answerCount).fill(''),carryValues:Array(count).fill(''),sideCarryValues:Array(count).fill(''),wrongHistory:Array(answerCount).fill(''),carryWrong:Array(count).fill(''),firstTry:true,solved:false,__schoolProofId:proof?.id||null}"],
  ["  function goMenu(){\n    clearMultiplicationHint();",
   "  function goMenu(){\n    if(proofFeed?.active){proofFeed.receiver.suspended?.();proofFeed=null}\n    clearMultiplicationHint();"],
  ["    if(session.mode==='sudden'){\n      let newly=0;\n      for(const i of candidates){\n        if(ev[i].correct){",
   "    if(session.mode==='sudden'){\n      let newly=0;\n      for(const i of candidates){\n        if(!mathasProofCapture(states[i])){setFeedback('Sauvegarde de la preuve impossible. Réessaie.','bad');return}\n        if(ev[i].correct){"],
  ["        }else{\n          markErrors(i);\n          endSudden(i);\n          return\n        }\n      }\n      updateBar();",
   "        }else{\n          if(proofFeed?.run.mode==='three-lives'&&!proofFeed.done){\n            markErrors(i);lockCalc(i);status(i,'Erreur · une vie perdue','bad');\n            session.completed++;continue;\n          }\n          markErrors(i);\n          endSudden(i);\n          return\n        }\n      }\n      updateBar();"],
  ["        setFeedback(\`Parfait : +\${newly}. Score : \${session.score}.\`,'ok');",
   "        setFeedback(proofFeed?.run.mode==='three-lives'?('3 vies · Score : '+session.score):\`Parfait : +\${newly}. Score : \${session.score}.\`,'ok');"],
  ["    let hadWrong=false;\n    for(const i of candidates){\n      if(ev[i].correct){",
   "    let hadWrong=false;\n    for(const i of candidates){\n      if(!mathasProofCapture(states[i])){setFeedback('Sauvegarde de la preuve impossible. Réessaie.','bad');return}\n      if(ev[i].correct){"],
  ["  function handlePrimary(){if(phase==='answering')verifyPair();else if(phase==='review'){makePair()}else if(phase==='finished'||phase==='ended')goMenu()}",
   "  function handlePrimary(){if(phase==='answering')verifyPair();else if(phase==='review'){if(proofFeed?.done){phase='ended';primaryBtn.textContent='Retour au menu';setFeedback('Série vérifiée par Connect.','ok')}else makePair()}else if(phase==='finished'||phase==='ended')goMenu()}"],
  ["    const label=hardSession.mode==='training'?'🧠 Entraînement':hardSession.mode==='challenge'?'🎯 5 calculs':'💀 Mort subite';",
   "    const label=proofFeed?.run.mode==='hard-three-lives'?'❤️ 3 vies':hardSession.mode==='training'?'🧠 Entraînement':hardSession.mode==='challenge'?'🎯 5 calculs':'💀 Mort subite';"],
  ["    if(!r.filled){setHardFeedback('Termine le calcul avant de vérifier.');return}\n    if(r.correct){",
   "    if(!r.filled){setHardFeedback('Termine le calcul avant de vérifier.');return}\n    if(!mathasProofHardCapture()){setHardFeedback('Sauvegarde de la preuve impossible. Réessaie.');return}\n    if(r.correct){"],
  ["    if(hardPhase==='review'){newHardCalc();return}",
   "    if(hardPhase==='review'){if(proofFeed?.done){hardPhase='ended';hardPrimary.textContent='Retour au menu HARD';setHardFeedback('Série vérifiée par Connect.')}else newHardCalc();return}"],
  ["    if(hardSession.mode==='sudden'){\n      const isRecord=hardSession.previousBest===null||hardSession.score>hardSession.previousBest;",
   "    if(hardSession.mode==='sudden'&&proofFeed?.run.mode==='hard-three-lives'&&!proofFeed.done){\n      hardSession.completed++;hardPhase='review';setHardEnabled(false);\n      hardPrimary.textContent='Calcul suivant';setHardFeedback('Erreur · une vie perdue. Continue.');\n      updateHardHeader();return;\n    }\n    if(hardSession.mode==='sudden'){\n      const isRecord=hardSession.previousBest===null||hardSession.score>hardSession.previousBest;"],
  ["  loadSettings();populateLevels();buildSlidableSelects();refreshMenuScores();refreshLastWork();",
   ENTRY+"\n  loadSettings();populateLevels();buildSlidableSelects();refreshMenuScores();refreshLastWork();"]
 ];
 let value=html;
 for(const [a,b] of changes){
  if(!value.includes(a))throw Error('Version native incompatible avec la preuve : '+a.slice(0,65));
  if(value.split(a).length!==2)throw Error('Ancrage natif ambigu : '+a.slice(0,65));
  value=value.replace(a,b);
 }
 return value;
}
