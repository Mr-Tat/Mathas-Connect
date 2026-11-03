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
