// Read-only adapter around the real, generated native Addition multiple engine.
// The original generated index.html and its independent source repository stay intact.
// In certified sessions only, inject server-issued operands and capture first entries.
(function(){
 'use strict';
 const swap=(text,from,to,label)=>{
  const pieces=text.split(from);
  if(pieces.length!==2)throw Error('Contrat Addition multiple : '+label+' ('+(pieces.length-1)+')');
  return pieces.join(to);
 };
 window.MathasCertifiedMultiPatch=function(game){
  const original="states=[0,1].map(()=>{const addendCount=randomAddendCount(session.level);const s=generateAddition(session.maxDigits,addendCount);s.addendCount=addendCount;return s});phase='answering';";
  const replacement=[
   "states=[0,1].map((_,i)=>{",
   " const proof=window.__mathasServerCertifiedMulti;",
   " let s,addendCount;",
   " if(proof?.sessionId&&session.mode==='classic'){",
   "  if(proof.level!==session.level||proof.total!==session.totalCalculs)throw Error('proof_configuration_changed');",
   "  const q=proof.questions?.[session.completed+i];",
   "  if(!q?.addends?.length)throw Error('proof_question_missing');",
   "  addendCount=q.addends.length;",
   "  const addends=[...q.addends],result=addends.reduce((sum,n)=>sum+n,0);",
   "  const p=carryPattern(addends,session.maxDigits),answerCount=String(result).length;",
   "  s={addends,result,count:session.maxDigits,answerCount,carryExpected:p.incoming,outgoing:p.outgoing,",
   "    answerValues:Array(answerCount).fill(''),carryValues:Array(session.maxDigits).fill(''),",
   "    wrongHistory:Array(answerCount).fill(''),carryWrong:Array(session.maxDigits).fill(''),",
   "    firstTry:true,solved:false,proofId:q.id,proofCaptured:false};",
   " }else{addendCount=randomAddendCount(session.level);s=generateAddition(session.maxDigits,addendCount);}",
   " s.addendCount=addendCount;return s",
   "});phase='answering';"
  ].join('\n');
  // L'ancien moteur est chargé dans une iframe isolée : reprendre en
  // réutilisant la paire serveur courante, sans changer sa génération libre.
  // This stable function boundary survives the surrounding wrapper's
  // layout and school-mode transformations (which change the session
  // initializer). Restore the cursor before generating the first pair only.
  const pairMarker="function makePair(){";
  const pairResume=[
   pairMarker,
   "const resumeProof=window.__mathasServerCertifiedMulti;",
   "if(resumeProof?.sessionId&&session?.mode==='classic'&&!resumeProof.resumeInitialized){",
   " resumeProof.resumeInitialized=true;",
   " const count=Number.isSafeInteger(resumeProof.resumeCount)?resumeProof.resumeCount:0;",
   " if(count>0&&count<session.totalCalculs){",
   "  session.completed=count-(count%2);",
   "  session.score=Number.isSafeInteger(resumeProof.resumeScore)?resumeProof.resumeScore:0;",
   " }",
   "}"
  ].join('\n');
  game=swap(game,pairMarker,pairResume,'reprise avant génération de la première paire');
  const renderMarker="active={kind:'answer',calc:0,col:0};calculationsPair.innerHTML='';states.forEach((s,i)=>renderCalc(s,i));mathasGateSecondCalc(true);";
  const renderResume=[
   renderMarker,
   "const proof=window.__mathasServerCertifiedMulti;",
   "if(proof?.sessionId&&proof.resumeCount%2===1",
   " &&session.completed===proof.resumeCount-1&&!proof.resumeApplied){",
   " proof.resumeApplied=true;",
   " states[0].proofCaptured=true;",
   " states[0].firstTry=proof.resumeCorrect?.[session.completed]===true;",
   " lockCalc(0);",
   " status(0,'Déjà vérifié avant la reprise','info');",
   "}"
  ].join('\n');
  game=swap(game,renderMarker,renderResume,'reprise du premier calcul de la paire');
  game=swap(game,original,replacement,'questions émises côté serveur');
  const before="// Calculs\n    let hadError=false;\n    for(const i of candidates){\n      const s=states[i];";
  const after=[
   "// Calculs",
   "    let hadError=false;",
   "    for(const i of candidates){",
   "      const s=states[i];",
   "      if(window.__mathasServerCertifiedMulti?.sessionId&&!s.proofCaptured){",
   "        s.proofCaptured=true;",
   "        window.MathasCertifiedMultipleAttempt?.({id:s.proofId,digits:[...s.answerValues],carries:[...s.carryValues]});",
   "      }"
  ].join('\n');
  game=swap(game,before,after,'premières saisies avant correction');
  return game;
 };
})();
