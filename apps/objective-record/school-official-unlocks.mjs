// Authoritative student progress originates from the authenticated Connect
// student-load response. Never read the standalone game's localStorage
// to decide whether a school reward or difficulty is unlocked.
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const allowedLevels=[1,2,3];
const validScore=(s,n)=>Number.isInteger(s)&&s>=0&&s<=n;
const safeArray=v=>Array.isArray(v)?v:[];
function best(state,level,total){
 const v=state?.classic?.[level-1]?.[String(total)];
 const n=Number(v);
 return v!==null&&v!==undefined&&validScore(n,total)?n:-1;
}
export function schoolUnlockProgress(state){
 const progress=state?.progress&&typeof state.progress==='object'&&!Array.isArray(state.progress)?state.progress:{};
 const passed=allowedLevels.map(level=>best(state,level,10)>=8||best(state,level,20)>=16);
 const perfect=allowedLevels.map(level=>best(state,level,10)===10||best(state,level,20)===20
  ||progress['perfect'+level]===true);
 const p={
  level2:progress.level2===true||passed[0],
  level3:progress.level3===true||passed[1],
  sudden1:progress.sudden1===true||progress.level2===true||passed[0],
  sudden2:progress.sudden2===true||progress.level3===true||passed[1],
  sudden3:progress.sudden3===true||perfect[2]||passed[2],
  perfect1:perfect[0],perfect2:perfect[1],perfect3:perfect[2],
  hard:perfect.every(Boolean)
 };
 return Object.freeze(p);
}
export function schoolHardRecords(state){
 const stored=safeArray(state?.hard);
 const score=i=>{
  const v=stored[i],n=Number(v);
  return v!==null&&v!==undefined&&Number.isSafeInteger(n)&&n>=0?n:0;
 };
 return Object.freeze({'1':score(0),'2':score(1),'3':score(2)});
}
export function schoolModeAllowed(profile,mode,level){
 if(!allowedLevels.includes(level)||!profile?.active||!APPS.has(profile.appKey))return false;
 const p=profile.progress;
 if(mode==='classic')return level===1||(level===2&&p.level2===true)||(level===3&&p.level3===true);
 if(mode==='sudden'||mode==='three-lives')return p['sudden'+level]===true;
 if(mode==='hard-sudden'||mode==='hard-three-lives'){
  if(p.hard!==true)return false;
  return level===1||profile.hardRecords[String(level-1)]>=3;
 }
 return false;
}
export function schoolModeLockReason(mode,level){
 if(!allowedLevels.includes(level))return 'Niveau non autorisé';
 if(mode==='classic')return 'Débloque le niveau '+level+' avec 8/10 ou 16/20 au niveau précédent.';
 if(mode==='sudden'||mode==='three-lives')
  return 'Objectif record : réussis 8/10 ou 16/20 au niveau '+level+' pour débloquer 3 vies et Mort subite.';
 if(mode.startsWith('hard-'))return level===1
  ?'HARD se débloque avec un sans-faute de 10 ou 20 calculs dans chacun des 3 niveaux.'
  :'HARD niveau '+level+' : atteins au moins 3 réussites en Mort subite HARD '+(level-1)+'.';
 return 'Mode non autorisé.';
}
export function schoolProgressSnapshot(appKey,state){
 if(!APPS.has(appKey))return null;
 return Object.freeze({
  active:true,appKey,
  progress:schoolUnlockProgress(state),
  hardRecords:schoolHardRecords(state)
 });
}
// Only copy an authenticated server snapshot into the original engine's
// isolated in-memory storage, so its ORIGINAL level locks/animations work.
// No data is persisted to the real browser localStorage by this bridge.
export function syncOfficialGameProgress(doc,profile){
 if(!doc?.defaultView||!profile?.active)return false;
 const w=doc.defaultView,appKey=profile.appKey;
 const progressKey=appKey==='addition-ecrite-simple'?'mathas_progression_addition_simple_v1'
  :appKey==='addition-ecrite-multiple'?'mathas_progression_addition_plusieurs_v1':null;
 const hardKey=appKey==='addition-ecrite-simple'?'addition1_hard_sudden_v1'
  :appKey==='addition-ecrite-multiple'?'addition2_hard_sudden_v3':null;
 if(!progressKey||!hardKey)return false;
 const serial=JSON.stringify([profile.progress,profile.hardRecords]);
 if(doc.__mathasSchoolOfficialProgressSignature===serial)return true;
 try{
  w.localStorage.setItem(progressKey,JSON.stringify(profile.progress));
  w.localStorage.setItem(hardKey,JSON.stringify(profile.hardRecords));
  doc.__mathasSchoolOfficialProgressSignature=serial;
  w.__refreshProgressionLocks?.();
  return true;
 }catch{return false}
}
