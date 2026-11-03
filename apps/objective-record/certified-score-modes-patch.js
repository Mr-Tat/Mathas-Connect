/* School score-mode adapter. Original native HTML engines stay unchanged.
 * This string patch runs only inside an isolated school srcdoc and fails closed.
 */
(function(){
 'use strict';
 const swap=(source,from,to,name)=>{
  const x=source.split(from);
  if(x.length!==2)throw Error('Certificat modes : '+name+' ('+(x.length-1)+' correspondances)');
  return x.join(to);
 };
 window.MathasCertifiedModesPatch=function(game,kind){
  if(!['simple','multi'].includes(kind))throw Error('Moteur de preuve inconnu');

  // Native normal modes show two calculations at once. Server operands must
  // replace both and carry the question ID through first validation.
  if(kind==='simple'){
   game=swap(game,
    "  function generateAddition(maxDigits){\n    const certified=window.__mathasServerCertified;",
    `  function generateAddition(maxDigits){
    const modes=window.__mathasServerCertifiedModes;
    if(modes?.sessionId&&session?.mode===modes.nativeMode){
      if(modes.level!==session.level)throw Error('score_mode_level_changed');
      const q=modes.questions?.[modes.index++];
      const addends=q?.addends?.map(Number);
      const low=10**(maxDigits-1),high=10**maxDigits;
      if(!q?.id||!addends||addends.length!==2
         ||!addends.every(Number.isSafeInteger)
         ||addends[0]<low||addends[0]>=high
         ||addends[1]<low/10||addends[1]>=high)
        throw Error('score_mode_question_missing');
      const [a,b]=addends,result=a+b;
      const p=carryPattern(a,b,maxDigits),answerCount=String(result).length;
      return {a,b,result,count:maxDigits,answerCount,
        carryExpected:p.incoming,outgoing:p.outgoing,
        answerValues:Array(answerCount).fill(''),carryValues:Array(maxDigits).fill(''),
        wrongHistory:Array(answerCount).fill(''),carryWrong:Array(maxDigits).fill(''),
        firstTry:true,solved:false,proofId:q.id,proofCaptured:false};
    }
    const certified=window.__mathasServerCertified;`,
    'émission normale addition simple');
   game=swap(game,
    "    if(window.__mathasServerCertified){\n      for(const i of candidates){",
    "    if(window.__mathasServerCertified||window.__mathasServerCertifiedModes){\n      for(const i of candidates){",
    'capture des deux modes simple');
   game=swap(game,
    "window.MathasCertifiedAttempt?.({",
    "(window.__mathasServerCertifiedModes?window.MathasCertifiedModeAttempt:window.MathasCertifiedAttempt)?.({",
    'capture initiale simple');
  }else{
   // The certified multiple patch already ran; reuse its makePair adapter.
   game=swap(game,"const proof=window.__mathasServerCertifiedMulti;",
      "const proof=window.__mathasServerCertifiedMulti||window.__mathasServerCertifiedModes;",
      'émission multiple');
   game=swap(game,"if(proof?.sessionId&&session.mode==='classic'){",
      "if(proof?.sessionId&&(session.mode==='classic'||session.mode===proof.nativeMode)){",
      'modes multiples');
   game=swap(game,"if(proof.level!==session.level||proof.total!==session.totalCalculs)throw Error('proof_configuration_changed');",
      "if(proof.level!==session.level||(session.mode==='classic'&&proof.total!==session.totalCalculs))throw Error('proof_configuration_changed');",
      'configuration multiple');
   game=swap(game,"const q=proof.questions?.[session.completed+i];",
      "const q=proof.questions?.[session.mode==='classic'?session.completed+i:proof.index++];",
      'index des questions multiples');
   game=swap(game,"const addends=[...q.addends],result=addends.reduce((sum,n)=>sum+n,0);",
      "const addends=q.addends.map(Number),result=addends.reduce((sum,n)=>sum+n,0);",
      'opérandes multiples numériques');
   game=swap(game,"if(window.__mathasServerCertifiedMulti?.sessionId&&!s.proofCaptured){",
      "if((window.__mathasServerCertifiedMulti?.sessionId||window.__mathasServerCertifiedModes?.sessionId)&&!s.proofCaptured){",
      'capture premières réponses multiple');
   game=swap(game,"window.MathasCertifiedMultipleAttempt?.({",
      "(window.__mathasServerCertifiedModes?window.MathasCertifiedModeAttempt:window.MathasCertifiedMultipleAttempt)?.({",
      'appel correct des réponses multiples');
  }

  // HARD has 10/12/16-digit simple sums or 9/12/14-digit multiaddend sums.
  // Keep decimal strings and BigInt: 16 digits are unsafe as Number.
  game=swap(game,"  function additionState(spec){",
   `  function additionState(spec){
    const proof=window.__mathasServerCertifiedModes;
    if(proof?.sessionId&&proof.mode?.startsWith('hard-')
       &&hardSession?.mode===proof.nativeMode){
      if(proof.level!==hardSession.level)throw Error('hard_proof_level_changed');
      const q=proof.questions?.[proof.index++],nums=q?.addends;
      if(!q?.id||!Array.isArray(nums)||nums.length!==spec.addends
        ||nums.some(n=>typeof n!=='string'||!/^\\d+$/.test(n)
          ||n.length>spec.digits||n.length<spec.digits-2))
        throw Error('hard_proof_question_missing');
      const addends=nums.map(String),result=addends.reduce(
        (a,b)=>a+BigInt(b),0n).toString();
      const incoming=Array(spec.digits).fill(0),outgoing=Array(spec.digits).fill(0);
      let carry=0;
      for(let col=0;col<spec.digits;col++){
        incoming[col]=carry;
        let sum=carry;
        addends.forEach(n=>sum+=digitAt(n,col));
        carry=Math.floor(sum/10);outgoing[col]=carry;
      }
      return {kind:'addition',addends,result,count:spec.digits,
        answerCount:result.length,incoming,outgoing,
        answers:Array(result.length).fill(''),carries:Array(spec.digits).fill(''),
        wrongAnswers:Array(result.length).fill(''),
        wrongCarries:Array(spec.digits).fill(''),
        proofId:q.id,proofCaptured:false};
    }`,
    'émission HARD grands nombres');

  game=swap(game,
   "    if(r.correct){\n      markAllGood();",
   `    // Capture BEFORE correction; SQL decides scores and exhausted hearts.
    if(window.__mathasServerCertifiedModes?.mode?.startsWith('hard-')
       &&!hardState.proofCaptured){
      hardState.proofCaptured=true;
      window.MathasCertifiedModeAttempt?.({
        id:hardState.proofId,digits:[...hardState.answers],
        carries:[...hardState.carries]});
    }
    if(r.correct){
      markAllGood();`,
   'première saisie HARD');
  return game;
 };
})();
