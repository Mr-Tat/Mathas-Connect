// The original engine writes its V3 trophies via a delayed 650ms gamification
// watcher, AFTER __setLastWork fires. Send on the actual trophy write, with
// one bounded fallback per completed part (no periodic polling).
(()=>{
 const TROPHIES='mathas_trophies_v3_addition-plusieurs';
 let armed=false,pending=[],flushScheduled=false;
 const nativeSet=Storage.prototype.setItem;
 function awards(){
  try{
   const t=JSON.parse(localStorage.getItem(TROPHIES)||'null');
   if(t&&typeof t==='object'&&!Array.isArray(t))return {
    version:3,mastery:t.mastery,sudden:t.sudden,
    hardAwards:t.hardAwards,scoreOne:t.scoreOne,unlockedGold:t.unlockedGold
   };
  }catch{}
  return null;
 }
 function send(event){
  clearTimeout(event.timer);
  const rewards=awards();
  window.parent.postMessage({
   type:'mathas-addition-plusieurs-audit-v1',
   label:event.label,score:event.score,rulerUsed:event.rulerUsed,
   ...(rewards?{rewards}:{})
  },window.parent.location.origin);
 }
 function flush(){
  flushScheduled=false;
  const events=pending;pending=[];
  for(const event of events)send(event);
 }
 function afterTrophyWrite(){
  if(!pending.length||flushScheduled)return;
  flushScheduled=true;
  queueMicrotask(flush);
 }
 Storage.prototype.setItem=function(key,value){
  const result=nativeSet.call(this,key,value);
  // The game's localStorage adapter scopes this exact native key first.
  if(this===localStorage&&String(key)===TROPHIES)afterTrophyWrite();
  return result;
 };
 function attach(){
  const original=window.__setLastWork;
  if(typeof original!=='function'||armed)return;
  armed=true;
  window.__setLastWork=function(entry){
   const result=original.apply(this,arguments);
   if(!entry||typeof entry.label!=='string')return result;
   const event={
    label:entry.label,score:String(entry.score??''),
    rulerUsed:entry.rulerUsed===true,timer:null
   };
   pending.push(event);
   event.timer=setTimeout(()=>{
    const i=pending.indexOf(event);
    if(i<0)return;
    pending.splice(i,1);
    send(event);
   },1750);
   return result;
  };
 }
 attach();
 if(!armed){
  let attempts=0;
  const timer=setInterval(()=>{attach();if(armed||++attempts>=30)clearInterval(timer)},50);
 }
})();