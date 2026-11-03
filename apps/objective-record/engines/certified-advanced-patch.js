// School-only read-only adapter. Works on the generated native HTML in memory.
// The source games remain unmodified; a server-issued challenge controls the
// operands. This patch neither decides nor submits XP, records or trophies.
(function(){
 'use strict';
 const change=(html,anchor,replacement,reason)=>{
  const chunks=html.split(anchor);
  if(chunks.length!==2)throw Error('Advanced arithmetic adapter: '+reason+
    ' ('+(chunks.length-1)+' matches)');
  return chunks.join(replacement);
 };
 const advancedCapture=[
  "    const advanced=window.__mathasServerAdvanced;",
  "    if(advanced?.sessionId&&!advanced.mode.startsWith('hard-')",
  "      &&(session.mode==='sudden'||session.mode==='three-lives')){",
  "      for(const i of candidates){",
  "        const s=states[i];",
  "        if(s.proofId&&!s.proofCaptured){",
  "          s.proofCaptured=true;",
  "          window.MathasAdvancedAttempt?.({id:s.proofId,",
  "            digits:[...s.answerValues],carries:[...s.carryValues]});",
  "        }",
  "      }",
  "    }"
 ].join('\n');
 const simpleNormal=[
  "  function generateAddition(maxDigits){",
  "    const proof=window.__mathasServerAdvanced;",
  "    if(proof?.sessionId&&!proof.mode.startsWith('hard-')&&session?.mode===proof.mode){",
  "      const q=proof.questions?.[proof.index++];",
  "      if(!q||q.op!=='add'||q.addends?.length!==2||proof.level!==session.level",
  "        ||q.addends.some(n=>!/^\\d+$/.test(n))){throw Error('advanced_question_unavailable');}",
  "      const a=Number(q.addends[0]),b=Number(q.addends[1]);",
  "      if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||maxDigits!==proof.width)",
  "        throw Error('advanced_width_mismatch');",
  "      const result=a+b,count=maxDigits,answerCount=String(result).length;",
  "      const p=carryPattern(a,b,count);",
  "      return{a,b,result,count,answerCount,carryExpected:p.incoming,",
  "        outgoing:p.outgoing,answerValues:Array(answerCount).fill(''),",
  "        carryValues:Array(count).fill(''),wrongHistory:Array(answerCount).fill(''),",
  "        carryWrong:Array(count).fill(''),firstTry:true,solved:false,",
  "        proofId:q.id,proofCaptured:false};",
  "    }"
 ].join('\n');
 const hardQuestion=[
  "    const advanced=window.__mathasServerAdvanced;",
  "    if(advanced?.sessionId&&advanced.mode==='hard-'+hardSession.mode",
  "      &&advanced.level===hardSession.level){",
  "      const q=advanced.questions?.[advanced.index++];",
  "      if(!q||!Array.isArray(q.addends)||q.op!=='add'||",
  "        q.addends.length!==hardSession.addends)throw Error('hard_proof_unavailable');",
  "      const addends=q.addends.map(String);",
  "      const result=addends.reduce((sum,n)=>sum+BigInt(n),0n).toString();",
  "      const count=hardSession.digits,answerCount=result.length;",
  "      const incoming=Array(count).fill(0),outgoing=Array(count).fill(0);",
  "      let carry=0;",
  "      for(let col=0;col<count;col++){",
  "        incoming[col]=carry;",
  "        for(const n of addends){carry+=Number(n[n.length-1-col]||0)}",
  "        carry=Math.floor(carry/10);outgoing[col]=carry;",
  "      }",
  "      hardState={kind:'addition',addends,result,count,answerCount,incoming,outgoing,",
  "        answers:Array(answerCount).fill(''),carries:Array(count).fill(''),",
  "        wrongAnswers:Array(answerCount).fill(''),wrongCarries:Array(count).fill(''),",
  "        proofId:q.id,proofCaptured:false};",
  "    }else{hardState=CFG.type==='addition'?additionState(hardSession.spec):subtractionState(hardSession.spec)};"
 ].join('\n');
 const hardCapture=[
  "    const proof=window.__mathasServerAdvanced;",
  "    if(proof?.sessionId&&proof.mode==='hard-'+hardSession.mode",
  "      &&hardState.proofId&&!hardState.proofCaptured){",
  "      hardState.proofCaptured=true;",
  "      window.MathasAdvancedAttempt?.({id:hardState.proofId,",
  "        digits:[...hardState.answers],carries:[...hardState.carries]});",
  "    }"
 ].join('\n');
 window.MathasCertifiedAdvancedPatch=function(game,kind){
  if(kind!=='simple'&&kind!=='multiple')throw Error('Unsupported advanced game');
  if(kind==='simple'){
   game=change(game,"  function generateAddition(maxDigits){",simpleNormal,'normal simple arithmetic');
  }
  game=change(game,
    "    if(session.mode==='three-lives'){\n      let right=0,lost=0;",
    advancedCapture+"\n    if(session.mode==='three-lives'){\n      let right=0,lost=0;",
    'first-attempt normal 3 lives/sudden capture');
  game=change(game,
    "    hardState=CFG.type==='addition'?additionState(hardSession.spec):subtractionState(hardSession.spec);",
    hardQuestion,'HARD server-authored arithmetic');
  game=change(game,
    "    if(r.correct){\n      markAllGood();",
    hardCapture+"\n    if(r.correct){\n      markAllGood();",
    'HARD first attempt before native mutation');
  return game;
 };
})();
