import {normalizeRewards} from './completion-contract.mjs';
// Read-only server-state -> original game's exact scoped record formats.
// Called before iframe.srcdoc, so no old pupil records are displayed at startup.
// Never merge an unsynced local result into the server's authoritative bests.
const safe=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
export function hydrateNativeRecords({storage,scope,state,pending=0}){
 if(typeof scope!=='string'||!/^connect\.[0-9a-f-]{36}\.[0-9a-f-]{36}$/.test(scope)||!storage)throw Error('invalid_hydration_scope');
 if(!Number.isSafeInteger(pending)||pending<0)throw Error('invalid_pending_count');
 if(pending>0)return false; // Reconcile offline results before replacing local records.
 if(state!=null&&(typeof state!=='object'||Array.isArray(state)))throw Error('invalid_server_state');
 const src=state??{},classic={levels:{}},sudden={levels:{}},hard={},hardThree={};
 for(let i=0;i<3;i++){
  const level=String(i+1),record=src.classic?.[i];
  if(record!=null&&(typeof record!=='object'||Array.isArray(record)))throw Error('invalid_classic_record');
  const scores={};
  for(const total of [4,10,20]){
   const score=record?.[total];
   if(score!=null){if(!safe(score,total))throw Error('invalid_classic_score');scores[total]=score}
  }
  if(Object.keys(scores).length)classic.levels[level]=scores;
  const suddenScore=src.sudden?.[i];
  if(suddenScore!=null){if(!safe(suddenScore,100000))throw Error('invalid_sudden_score');sudden.levels[level]=suddenScore}
  const hardScore=src.hard?.[i];
  if(hardScore!=null){if(!safe(hardScore,100000))throw Error('invalid_hard_score');hard[level]=hardScore}
  const challenge=src.hardThree?.[i];
  if(challenge!=null){if(!safe(challenge,5))throw Error('invalid_hard_challenge');hardThree[level]=challenge}
 }
 const progress=src.progress??{};
 if(typeof progress!=='object'||Array.isArray(progress))throw Error('invalid_server_progress');
 const achieved=l=>{
  const scores=classic.levels[String(l)]||{};
  return (scores[10]!=null&&scores[10]>=8)||(scores[20]!=null&&scores[20]>=16);
 };
 const perfect=l=>{
  const scores=classic.levels[String(l)]||{};
  return scores[10]===10||scores[20]===20;
 };
 const p={};
 for(let i=1;i<=3;i++){
  p['sudden'+i]=progress['sudden'+i]===true||achieved(i);
  p['perfect'+i]=progress['perfect'+i]===true||perfect(i);
 }
 p.level2=progress.level2===true||p.sudden1;
 p.level3=progress.level3===true||p.sudden2;
 p.hard=progress.hard===true||(p.perfect1&&p.perfect2&&p.perfect3);
 // Server remains authoritative after a teacher parcours reset or device switch.
 // Trophy flags use the same V3 key and object shape as the original engine.
 const awards=src.rewards==null?null:normalizeRewards(src.rewards);
 if(src.rewards!=null&&!awards)throw Error('invalid_server_rewards');
 const prefix='mathas.addition-plusieurs.game.'+scope+'.v1:';
 for(const [name,value] of Object.entries({
  'addition2_classic_v1':classic,
  'addition2_sudden_v1':sudden,
  'addition2_hard_sudden_v3':hard,
  'addition2_hard_three_v2':hardThree,
  'mathas_progression_addition_plusieurs_v1':p
 }))storage.setItem(prefix+name,JSON.stringify(value));
 // The native V6.0.2 engine migrates legacy HARD records and reconstructs
 // trophies from lastWork and historic points. After teacher reset those are
 // NOT authoritative: strip only game-derived caches, never preferences,
 // authentication, queued attempts or other applications.
 for(const legacy of [
  'addition2_last_work',
  'addition2_hard_sudden_v1','addition2_hard_sudden_v2',
  'addition2_hard_three_v1',
  'mathas_points_v1_addition-plusieurs',
  'mathas_trophies_v1_addition-plusieurs','mathas_trophies_v2_addition-plusieurs',
  'mathas_easy_trophies_v1_addition-plusieurs',
  'mathas_scores_srcdoc'
 ])storage.removeItem(prefix+legacy);
 const trophyKey=prefix+'mathas_trophies_v3_addition-plusieurs';
 if(awards)storage.setItem(trophyKey,JSON.stringify(awards));
 else storage.removeItem(trophyKey);
 return true;
}
