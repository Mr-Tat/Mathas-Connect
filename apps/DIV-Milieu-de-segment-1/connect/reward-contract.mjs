// Validated 26/11/2026. Server reward model; no client points accepted.
import {judgeNativeCompletion} from './completion-proof.mjs';
export const APP_KEY='milieu-segment',XP_MAX=280,RULESET=2;
export const LEVELS=Object.freeze({even:{n:10,p:2,xp:[8,6,6]},odd:{n:10,p:2,xp:[8,6,6]},mix:{n:10,p:2,xp:[8,6,6]},gi1:{n:6,p:1,xp:[8,4]},gi2:{n:6,p:1,xp:[10,6]},decimal:{n:10,p:2,xp:[8,6,6]},g1:{n:5,p:1,xp:[8,4]},g2:{n:10,p:1,xp:[10,6]},g3:{n:10,p:1,xp:[16,8]}});
export const ORDER=Object.keys(LEVELS),GEO={integers:['gi1','gi2'],decimals:['g1','g2','g3']},THRESHOLDS=[5,10,20];
export const family=k=>['even','odd','mix','gi1','gi2'].includes(k)?'integers':'decimals';
const clone=x=>JSON.parse(JSON.stringify(x));
const recordKey=(k,mode)=>family(k)+':'+mode;
const challengeIds=['integers:sudden','integers:lives','decimals:sudden','decimals:lives'];
const milestones=k=>LEVELS[k].xp.map((v,i)=>[k+':'+(i===LEVELS[k].p?'perfect':'pass'+(i+1)),v]);
const recordMilestones=f=>THRESHOLDS.map(t=>[f+':record:'+t,f==='integers'?16:24]);
export const RIGHTS=Object.freeze(Object.fromEntries([...ORDER.flatMap(milestones),...Object.keys(GEO).flatMap(recordMilestones)]));
export const TROPHIES=Object.freeze([...ORDER.filter(k=>!k.startsWith('g')),...Object.keys(GEO).map(f=>f+':segments'),...Object.keys(GEO).flatMap(f=>THRESHOLDS.map(t=>f+':sudden:'+t))]);
const blankScore=()=>({allBest:0,dayBest:0,dayDate:null,allEvent:null,dayEvent:null});
export const initialState=()=>({levels:{},records:{},recordCounts:{},scoresByActivity:{},rights:{},bonusRights:{},archivedBonusXp:0,repeatKeys:[],cups:{},decimalUnlocked:false,epoch:0});
export const passing=(s,k)=>(s.levels[k]||[]).filter(x=>x.percent>=80).length>=LEVELS[k].p;
export const cleanPerfect=(s,k)=>(s.levels[k]||[]).filter(x=>x.percent===100&&x.clean).length>=LEVELS[k].p;
export const challengesOpen=(s,f)=>GEO[f].every(k=>passing(s,k));
export function canPlay(s,k,mode=null,teacherFree=false){
 if(!Object.hasOwn(LEVELS,k))return false;
 if(mode!==null)return ['sudden','lives'].includes(mode)&&['gi2','g3'].includes(k)&&challengesOpen(s,family(k));
 if(teacherFree)return true;
 if(k==='decimal')return s.decimalUnlocked||challengesOpen(s,'integers');
 return k===ORDER[0]||passing(s,ORDER[ORDER.indexOf(k)-1]);
}
export function segmentPoints(k,mode,helps=[]){
 if(!Object.hasOwn(LEVELS,k)||!Array.isArray(helps))throw Error('invalid_completion');
 if(!k.startsWith('g'))return 0;
 const base=family(k)==='integers'?2:3;
 if(mode)return mode==='sudden'?base*2:base;
 return base-(['gi2','g2','g3'].includes(k)&&helps.includes('manip')?1:0)-(k==='g3'&&helps.includes('decomp')?1:0);
}
export function judgeCompletion(proof){
 const j=judgeNativeCompletion(proof);
 return {...j,percent:Math.round(100*j.firstGood/j.total),points:j.items.reduce((sum,item)=>sum+(item.firstGood?segmentPoints(j.activity,j.mode,item.helps):0),0)};
}
export const xpTotal=s=>(s.archivedBonusXp||0)+Object.values(s.rights).reduce((a,b)=>a+b,0)+Object.values(s.bonusRights).reduce((a,b)=>a+b,0);
export function remaining(s){
 const left=entries=>entries.reduce((sum,[key,max])=>sum+(s.repeatKeys.includes(key)?max-(s.bonusRights[s.epoch+':'+key]||0):max-(s.rights[key]||0)),0);
 return Object.fromEntries([...ORDER.map(k=>[k,left(milestones(k))]),...challengeIds.map(k=>[k,left(recordMilestones(k.split(':')[0]))])]);
}
export function scoreRecords(s,day){
 const r=blankScore();r.dayDate=day;
 for(const a of Object.values(s.scoresByActivity)){
  if(a.allBest>r.allBest){r.allBest=a.allBest;r.allEvent=a.allEvent}
  if(a.dayDate===day&&a.dayBest>r.dayBest){r.dayBest=a.dayBest;r.dayEvent=a.dayEvent}
 }return r;
}
// Only after identity, idempotency, epoch and revision validation.
export function applyJudgement(old,j,{eventId,day,teacherFree=false}={}){
 const s=clone(old),before=xpTotal(s),k=j.activity,f=family(k);
 if(!canPlay(s,k,j.mode,teacherFree))throw Error('activity_locked');
 const award=key=>{const max=RIGHTS[key];if(!max)throw Error('invalid_milestone');
  if(s.repeatKeys.includes(key)&&s.rights[key]===max)s.bonusRights[s.epoch+':'+key]=max;
  else s.rights[key]=max;
 };
 if(j.mode){
  const rk=recordKey(k,j.mode);s.records[rk]=Math.max(s.records[rk]||0,j.points);s.recordCounts[rk]=Math.max(s.recordCounts[rk]||0,j.firstGood);
  for(const t of THRESHOLDS)if(j.firstGood>=t){award(f+':record:'+t);if(j.mode==='sudden')s.cups[f+':sudden:'+t]=true}
 }else{
  const spec=LEVELS[k],rows=[...(s.levels[k]||[]),{percent:j.percent,clean:j.clean,points:j.points}];
  rows.sort((a,b)=>b.percent-a.percent||Number(b.clean)-Number(a.clean)||b.points-a.points);
  s.levels[k]=rows.slice(0,spec.p);
  for(let i=0;i<s.levels[k].filter(x=>x.percent>=80).length;i++)award(k+':pass'+(i+1));
  if(j.percent===100&&j.clean)award(k+':perfect');
  if(k.startsWith('g')){if(GEO[f].every(x=>cleanPerfect(s,x)))s.cups[f+':segments']=true}
  else if(cleanPerfect(s,k))s.cups[k]=true;
 }
 if(challengesOpen(s,'integers'))s.decimalUnlocked=true;
 if(k.startsWith('g')&&eventId&&day){
  const key=j.mode?recordKey(k,j.mode):k,r=s.scoresByActivity[key]??blankScore();
  if(r.dayDate!==day){r.dayDate=day;r.dayBest=0;r.dayEvent=null}
  if(j.points>r.dayBest){r.dayBest=j.points;r.dayEvent=eventId}
  if(j.points>r.allBest){r.allBest=j.points;r.allEvent=eventId}
  s.scoresByActivity[key]=r;
 }
 if(Object.values(s.rights).reduce((a,b)=>a+b,0)>XP_MAX)throw Error('xp_cap');
 return {state:s,xpDelta:xpTotal(s)-before};
}
export function resetProgression(old,scope,repeatXp=false){
 if(!['all','integerGeometry','decimalGeometry'].includes(scope)||typeof repeatXp!=='boolean')throw Error('invalid_scope');
 const archive=clone(old),s=clone(old),families=scope==='all'?Object.keys(GEO):[scope==='integerGeometry'?'integers':'decimals'];
 const ids=scope==='all'?ORDER:families.flatMap(f=>GEO[f]);
 for(const k of ids){delete s.levels[k];delete s.scoresByActivity[k]}
 for(const k of challengeIds)if(families.includes(k.split(':')[0])){delete s.records[k];delete s.recordCounts[k];delete s.scoresByActivity[k]}
 if(scope==='all')s.decimalUnlocked=false;
 s.archivedBonusXp=(s.archivedBonusXp||0)+Object.values(s.bonusRights).reduce((a,b)=>a+b,0);s.bonusRights={};
 s.epoch++;
 s.repeatKeys=repeatXp?[...ids.flatMap(milestones),...families.flatMap(recordMilestones)].map(([key])=>key).filter(key=>s.rights[key]===RIGHTS[key]):[];
 return {archive,state:s};
}
