(()=>{
 let armed=false;
 function attach(){
  const original=window.__setLastWork;
  if(typeof original!=='function'||armed)return;
  armed=true;
  window.__setLastWork=function(entry){
   const result=original.apply(this,arguments);
   if(!entry||typeof entry.label!=='string')return result;
   // The original game may update its trophy storage AFTER __setLastWork.
   // Read the final snapshot on the next event-loop turn, not before.
   const label=entry.label,score=String(entry.score??''),rulerUsed=entry.rulerUsed===true;
   setTimeout(()=>{
    let rewards=null;
    try{
     const key='mathas_trophies_v3_addition-plusieurs';
     const candidate=JSON.parse(localStorage.getItem(key)||'null');
     if(candidate&&typeof candidate==='object'&&!Array.isArray(candidate))
      rewards={
       version:3,
       mastery:candidate.mastery,sudden:candidate.sudden,
       hardAwards:candidate.hardAwards,scoreOne:candidate.scoreOne,
       unlockedGold:candidate.unlockedGold
      };
    }catch{}
    window.parent.postMessage({
     type:'mathas-addition-plusieurs-audit-v1',label,score,rulerUsed,
     ...(rewards?{rewards}:{})
    },window.parent.location.origin);
   },0);
   return result;
  };
 }
 attach();
 if(!armed){
  let count=0;
  const timer=setInterval(()=>{attach();if(armed||++count>=30)clearInterval(timer)},50);
 }
})();