import {normalizeRewards} from './rewards-contract.mjs';
import {empty} from './records.mjs';
// Native display keeps ONE record per level. Connect retains ALL 4/10/20 records separately.
export function hydrateNativeRecords({storage,scope,state,pending=0}){
 if(!/^connect\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f-]{36}$/.test(scope))throw Error('invalid_hydration_scope');
 if(!Number.isSafeInteger(pending)||pending<0)throw Error('invalid_pending');
 if(pending)return false;
 const s=state??empty(),classic={},sudden={},hard={},progress={};
 const valid=(v,max)=>v==null||(Number.isSafeInteger(v)&&v>=0&&v<=max);
 for(let i=0;i<3;i++){
  const scores=s.classic?.[i]??{};
  for(const total of [4,10,20]){
   const score=scores[total];if(!valid(score,total))throw Error('invalid_classic');
   const old=classic[i+1];
   if(score!=null&&(!old||score/total>old.score/old.total||(score/total===old.score/old.total&&total>old.total)))classic[i+1]={score,total,aideVisuelle:s.recordAid?.classic?.[i]?.[total]===true};
  }
  for(const mode of ['sudden','hard'])if(!valid(s[mode]?.[i],1000))throw Error('invalid_record');
  if(s.sudden?.[i]!=null)sudden[i+1]={score:s.sudden[i],aideVisuelle:s.recordAid?.sudden?.[i]===true};
  if(s.hard?.[i]!=null)hard[i+1]=s.hard[i];
  progress['sudden'+(i+1)]=scores[10]>=8||scores[20]>=16;
  progress['perfect'+(i+1)]=scores[10]===10||scores[20]===20;
 }
 progress.level2=progress.sudden1;progress.level3=progress.sudden2;progress.hard=progress.perfect1&&progress.perfect2&&progress.perfect3;
 const prefix='mathas.calculs-melanges.game.'+scope+'.v1:';
 for(const [key,value] of Object.entries({'mixcalc_classic_v1':classic,'mixcalc_sudden_v1':sudden,'mixcalc_hard_v1':hard,'mathas_progression_melange_de_calculs_v1':progress,'mixcalc_connect_proofs_v1':s}))storage.setItem(prefix+key,JSON.stringify(value));
 // Native trophies are display-only and reconstructed by the engine, never XP evidence.
 for(const key of ['mixcalc_last_v1','mix_hard_three_v1','mathas_points_v1_melange-calculs','mathas_trophies_v1_melange-calculs','mathas_trophies_v2_melange-calculs','mathas_trophies_v3_melange-calculs','mathas_recent_two_scores_v1_melange-calculs'])storage.removeItem(prefix+key);
 const rewards=normalizeRewards(s.rewards);
 if(rewards)storage.setItem(prefix+'mathas_trophies_v3_melange-calculs',JSON.stringify(rewards));
 return true;
}
