// Pure validation of the OFFICIAL Connect response. Never derive XP from the demo.
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple',
 'soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits']);
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
export function studentHostContract({xp,loaded,appKey}={}){
 if(!APPS.has(appKey)||loaded?.ok!==true||xp?.ok!==true
   ||!count(loaded.revision)||!count(loaded.resetEpoch)
   ||!count(xp.appXp)||!count(xp.total)||!count(xp.level)
   ||xp.level<1||xp.appXp>xp.total)return null;
 return Object.freeze({appXp:xp.appXp,total:xp.total,level:xp.level,
  revision:loaded.revision,resetEpoch:loaded.resetEpoch});
}
// Treat unavailable data as unknown, NOT zero. The Edge returns rewards
// from the independent connect_trophy_achievements registry after a reset.
export function permanentTrophyCount(rewards){
 if(!rewards||typeof rewards!=='object'||Array.isArray(rewards)
   ||rewards.version!==3)return null;
 const yes=x=>x===true?1:0;
 const levels=values=>Array.isArray(values)&&values.length===3&&
    values.every(x=>typeof x==='boolean')?values.reduce((n,x)=>n+yes(x),0):null;
 const mastery=rewards.mastery;
 const hard=rewards.hardAwards;
 const score=rewards.scoreOne;
 if(!mastery||!hard||!score)return null;
 const groups=[
  levels(mastery['4']),levels(mastery['10']),levels(mastery['20']),
  levels(rewards.sudden),
  levels(hard.bronze),levels(hard.silver),levels(hard.gold)
 ];
 if(groups.some(n=>n===null)||['bronze','silver','gold'].some(k=>typeof score[k]!=='boolean')
   ||typeof rewards.unlockedGold!=='boolean')return null;
 return groups.reduce((a,b)=>a+b,0)+yes(score.bronze)+yes(score.silver)+yes(score.gold)+yes(rewards.unlockedGold);
}
