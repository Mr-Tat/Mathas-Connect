// Server-issued mathematics in the actual native subtraction grid.
const CHANGES=[
 [
  "let session=null, states=[], phase='answering', active={kind:'answer',calc:0,col:0,replace:false}, scoreRulerVisible=false;",
  "let session=null, states=[], phase='answering', active={kind:'answer',calc:0,col:0,replace:false}, scoreRulerVisible=false;\n  let proofFeed=null;"
 ],
 [
  "  function goMenu(){removeCelebrations();",
  "  function goMenu(){if(proofFeed?.active){proofFeed.receiver.suspended?.();proofFeed=null}removeCelebrations();"
 ],
 [
  "    let top,bottom,result,count,bottomLength,pattern;\n    for(let tries=0;tries<50000;tries++){",
  "    let top,bottom,result,count,bottomLength,pattern;\n    if(proofFeed?.active){\n      const proof=proofFeed.run.questions[proofFeed.cursor++];\n      if(!proof)throw Error('Série serveur épuisée');\n      if(proof.method!==session.borrowMethod)throw Error('Technique d’emprunt incompatible');\n      top=Number(proof.a);bottom=Number(proof.b);\n      if(!Number.isSafeInteger(top)||!Number.isSafeInteger(bottom)||top<=bottom)throw Error('Calcul serveur invalide');\n      count=proof.width;bottomLength=String(bottom).length;result=top-bottom;\n      pattern=borrowPattern(top,bottom,count);\n      if(!pattern)throw Error('Emprunt serveur invalide');\n      return{count,top,bottom,result,answerCount:count,bottomLength,\n       topDigits:digitsRTL(top,count),bottomDigits:digitsRTL(bottom,count),\n       borrowed:Array(count).fill(false),carry:Array(count).fill(0),\n       adjustValues:Array(count).fill(''),adjustExpected:Array(count).fill(null),\n       firstTry:true,solved:false,wrongHistory:Array(count).fill(''),__mathasProofId:proof.id};\n    }\n    for(let tries=0;tries<50000;tries++){"
 ],
 [
  "    // Trois vies : même moteur de vérification des résultats et emprunts.",
  "\n    if(proofFeed?.active){\n      for(const i of candidates){\n        const state=states[i];\n        if(!state?.__mathasProofId||state.__mathasProofCaptured)continue;\n        const inputs=[...opFor(i).querySelectorAll('.answer-input')];\n        inputs.sort((a,b)=>Number(b.dataset.col)-Number(a.dataset.col));\n        const answer=inputs.map(input=>input.value).join('');\n        if(!/^\\d+$/.test(answer)||!proofFeed.receiver.record({id:state.__mathasProofId,answer})){\n          setFeedback('Sauvegarde de la preuve impossible. Vérifie l’espace de stockage.','bad');return;\n        }\n        state.__mathasProofCaptured=true;\n      }\n    }\n    // Trois vies : même moteur de vérification des résultats et emprunts."
 ],
 [
  "  function advancePair(){makePair()}",
  "  function advancePair(){if(proofFeed?.done){proofFeed.active=false;phase='ended';setPrimaryActionLabel('Retour au menu');setFeedback('Série officielle terminée.','ok');return}makePair()}"
 ],
 [
  "  refreshMenuScores()\n})();",
  "\n  window.MathasSubtractionNativeProof=Object.freeze({\n   launch(run,receiver){\n    if(proofFeed?.active||!run||!receiver||!Array.isArray(run.questions)\n     ||!Array.isArray(run.answers)||!['classic','sudden','three-lives'].includes(run.mode)\n     ||![1,2,3].includes(run.level)||!['takeTop','addBottom'].includes(run.method))return false;\n    const state=receiver.progress();\n    if(!state||state.complete)return false;\n    const prior=run.answers.length,base=prior-(prior%2);\n    proofFeed={active:true,run,receiver,cursor:base,done:false};\n    const digits=[3,5,7][run.level-1];\n    classicMaxDigits.value=String(digits);\n    suddenMaxDigits.value=String(digits);\n    trainingMaxDigits.value=String(digits);\n    borrowMethodInputs.forEach(x=>{x.checked=x.value===run.method});\n    if(run.mode==='classic')updateClassicCountUI(run.total);\n    try{\n     startSession(run.mode);\n     if(prior%2){\n      states[0].__mathasProofCaptured=true;\n      states[0].firstTry=false;\n      lockCalc(0);\n      status(0,'Déjà vérifié avant la reprise','ok');\n     }\n     session.completed=base;\n     session.score=state.correct;\n     if(run.mode==='three-lives')session.lives=state.livesLeft;\n     updateBar();\n     return true;\n    }catch(e){\n     proofFeed=null;\n     receiver.problem?.('Impossible d’ouvrir la série native : '+e.message);\n     return false;\n    }\n   },\n   completed(){if(proofFeed)proofFeed.done=true},\n   active(){return !!proofFeed?.active},\n   abandonView(){proofFeed=null},\n   home(){proofFeed=null;goMenu()}\n  });\n  refreshMenuScores()\n})();"
 ]
];
export function injectNativeSubtractionProof(html){
 if(typeof html!=='string')throw Error('native_subtraction_engine_missing');
 let out=html;
 for(const [a,b] of CHANGES){
  if(out.split(a).length!==2)throw Error('Incompatible native subtraction proof anchor: '+a.slice(0,72));
  out=out.replace(a,b);
 }
 return out;
}
