import {permanentTrophyCount} from './student-host-contract.mjs';

const ADDITIONS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const keys=['bronze','silver','gold'];

// Trust ONLY the authenticated student-load rewards, not the native browser's
// localStorage trophies. Copy all 25 award fields, never numeric XP milestones.
export function officialAdditionRewards(appKey,rewards){
 if(!ADDITIONS.has(appKey)||permanentTrophyCount(rewards)===null)return null;
 return Object.freeze({
  version:3,
  mastery:Object.fromEntries([4,10,20].map(n=>[n,Object.freeze([...rewards.mastery[n]])])),
  sudden:Object.freeze([...rewards.sudden]),
  hardAwards:Object.fromEntries(keys.map(k=>[k,Object.freeze([...rewards.hardAwards[k]])])),
  scoreOne:Object.fromEntries(keys.map(k=>[k,rewards.scoreOne[k]])),
  unlockedGold:rewards.unlockedGold
 });
}
