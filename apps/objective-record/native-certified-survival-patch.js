// Math'as Connect: reuse the ORIGINAL addition game for certified survival.
// Applied to the isolated srcdoc, not to the vendor's generated engine.
// The host supplies PostgreSQL-issued questions and records first attempts;
// the native score is always provisional until the server receipt.
(function(){
 'use strict';
 const swap=(source,oldText,newText,label)=>{
  const parts=source.split(oldText);
  if(parts.length!==2)throw Error('Pont natif certifié : contrat '+label+' modifié ('+(parts.length-1)+')');
  return parts[0]+newText+parts[1];
 };
 window.MathasCertifiedSurvivalPatch=function(game,kind){
  if(!['add','multi'].includes(kind))throw Error('Pont natif : jeu non autorisé');
  const multiple=kind==='multi';
  const normalFn=multiple?'function generateAddition(maxDigits,addendCount){':'function generateAddition(maxDigits){';
  const normalBody=[
   'const proof=window.__mathasServerCertifiedExtended;',
   "if(proof?.sessionId&&!proof.mode.startsWith('hard-')&&proof.mode===session?.mode){",
   ' const q=proof.questions?.[proof.index++];',
   " if(!q||q.op!=='add'||q.width!==maxDigits||proof.width!==maxDigits||proof.level!==session.level)",
   "  throw Error('certified_survival_question_mismatch');",
   " const addends=q.addends.map(Number);",
   " if(addends.some(n=>!Number.isSafeInteger(n)||n<=0))throw Error('certified_survival_invalid_operand');",
   multiple
     ?" const p=carryPattern(addends,maxDigits),result=addends.reduce((s,n)=>s+n,0);"
     :" const p=carryPattern(addends[0],addends[1],maxDigits),result=addends[0]+addends[1];",
   ' const answerCount=String(result).length;',
   multiple
    ?" return {addends,result,count:maxDigits,answerCount,carryExpected:p.incoming,outgoing:p.outgoing,"
    :" return {a:addends[0],b:addends[1],result,count:maxDigits,answerCount,carryExpected:p.incoming,outgoing:p.outgoing,",
   "  answerValues:Array(answerCount).fill(''),carryValues:Array(maxDigits).fill(''),",
   "  wrongHistory:Array(answerCount).fill(''),carryWrong:Array(maxDigits).fill(''),",
   "  firstTry:true,solved:false,proofId:q.id,proofCaptured:false};",
   '}'
  ].join('\n');
  game=swap(game,normalFn,normalFn+'\n'+normalBody,'questions normales');
  const hardBody=[
   'const proof=window.__mathasServerCertifiedExtended;',
   "if(proof?.sessionId&&proof.mode==='hard-'+hardSession?.mode){",
   ' const q=proof.questions?.[proof.index++];',
   " if(!q||q.op!=='add'||q.width!==spec.digits||proof.width!==spec.digits",
   "    ||proof.level!==spec.level||q.addends.length!=="+(multiple?'spec.addends':'2')+")",
   "  throw Error('certified_hard_question_mismatch');",
   " const addends=[...q.addends];",
   " const result=addends.reduce((sum,n)=>sum+BigInt(n),0n).toString();",
   ' const incoming=Array(spec.digits).fill(0),outgoing=Array(spec.digits).fill(0);',
   ' let carry=0;',
   ' for(let c=0;c<spec.digits;c++){',
   '  incoming[c]=carry;let sum=carry;',
   '  for(const n of addends)sum+=digitAt(n,c);',
   '  carry=Math.floor(sum/10);outgoing[c]=carry;',
   ' }',
   " return {kind:'addition',addends,result,count:spec.digits,answerCount:result.length,",
   '  incoming,outgoing,answers:Array(result.length).fill(\'\'),',
   '  carries:Array(spec.digits).fill(\'\'),wrongAnswers:Array(result.length).fill(\'\'),',
   '  wrongCarries:Array(spec.digits).fill(\'\'),proofId:q.id,proofCaptured:false};',
   '}'
  ].join('\n');
  game=swap(game,'function additionState(spec){','function additionState(spec){\n'+hardBody,'questions HARD');
  const captureNormal=[
   "if(window.__mathasServerCertifiedExtended?.sessionId&&",
   "   window.__mathasServerCertifiedExtended.mode===session.mode){",
   ' const s=states[i];',
   ' if(s.proofId&&!s.proofCaptured){',
   '  s.proofCaptured=true;',
   '  window.MathasCertifiedExtendedAttempt?.({id:s.proofId,',
   '   digits:[...s.answerValues],carries:[...s.carryValues]});',
   ' }',
   '}'
  ].join('\n');
  game=swap(game,
   "    if(session.mode==='three-lives'){\n      let right=0,lost=0;\n      for(const i of candidates){\n        if(evals[i].correct){",
   "    if(session.mode==='three-lives'){\n      let right=0,lost=0;\n      for(const i of candidates){\n"+captureNormal+"\n        if(evals[i].correct){",
   'première réponse trois vies');
  game=swap(game,
   "    if(session.mode==='sudden'){\n      let newly=0;\n      for(const i of candidates){\n        if(evals[i].correct){",
   "    if(session.mode==='sudden'){\n      let newly=0;\n      for(const i of candidates){\n"+captureNormal+"\n        if(evals[i].correct){",
   'première réponse mort subite');
  const captureHard=[
   "if(window.__mathasServerCertifiedExtended?.sessionId&&",
   "   window.__mathasServerCertifiedExtended.mode==='hard-'+hardSession.mode",
   '   &&hardState.proofId&&!hardState.proofCaptured){',
   ' hardState.proofCaptured=true;',
   ' window.MathasCertifiedExtendedAttempt?.({id:hardState.proofId,',
   '  digits:[...hardState.answers],carries:[...hardState.carries]});',
   '}'
  ].join('\n');
  game=swap(game,
   "    if(r.correct){\n      markAllGood();",
   '    '+captureHard+"\n    if(r.correct){\n      markAllGood();",
   'première réponse HARD');
  game=swap(game,'function makePair(){',
   "function makePair(){if(window.__mathasServerCertifiedExtended?.finished)return;",
   'limite 120 calculs normaux');
  game=swap(game,'function newHardCalc(){',
   "function newHardCalc(){if(window.__mathasServerCertifiedExtended?.finished)return;",
   'limite 120 calculs HARD');
  game=swap(game,'function saveSuddenBest(){',
   "function saveSuddenBest(){if(window.__mathasServerCertifiedExtended?.sessionId)return;",
   'record natif normal');
  game=swap(game,'function saveBest(){',
   "function saveBest(){if(window.__mathasServerCertifiedExtended?.sessionId)return;",
   'record natif HARD');
  return game;
 };
})();
