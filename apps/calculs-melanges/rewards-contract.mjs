export function normalizeRewards(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const triple=items=>Array.isArray(items)&&items.length===3&&items.every(x=>typeof x==='boolean')?items.slice():null;
 const mastery={},hardAwards={},scoreOne={};
 for(const n of ['4','10','20']){const t=triple(raw.mastery?.[n]);if(!t)return null;mastery[n]=t}
 const sudden=triple(raw.sudden);if(!sudden)return null;
 for(const color of ['bronze','silver','gold']){
  const t=triple(raw.hardAwards?.[color]);
  if(!t||typeof raw.scoreOne?.[color]!=='boolean')return null;
  hardAwards[color]=t;scoreOne[color]=raw.scoreOne[color];
 }
 if(typeof raw.unlockedGold!=='boolean')return null;
 return {version:3,mastery,sudden,hardAwards,scoreOne,unlockedGold:raw.unlockedGold};
}
