// Candidat de contrat serveur : les jugements sont calculés à partir des essais, pas des scores du client.
export const APP_KEY='milieu-segment',XP_MAX=204;
export const LEVELS={even:{n:10,p:2,xp:[8,6,6]},odd:{n:10,p:2,xp:[8,6,6]},mix:{n:10,p:2,xp:[8,6,6]},decimal:{n:10,p:2,xp:[8,6,6]},g1:{n:5,p:1,xp:[8,4]},g2:{n:10,p:1,xp:[10,6]},g3:{n:10,p:1,xp:[16,8]}};
export const ORDER=Object.keys(LEVELS);
const GEO=['g1','g2','g3'],RECORD=['sudden','lives'],THRESHOLDS=[5,10,20];
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const fail=()=>{throw Error('invalid_completion')};
const clone=x=>JSON.parse(JSON.stringify(x));
export function validNumber(k,n){if(!int(n,1,200)||n%2)return false;return k==='even'?n%20===0:k==='odd'?n%20===10:k==='mix'?n%10===0:k==='decimal'?[2,4,6,8].includes(n%10):[...GEO,...RECORD].includes(k)&&n>=20}
export function segmentPoints(k,decomp=false,manip=false){if(![...GEO,...RECORD].includes(k)||typeof decomp!=='boolean'||typeof manip!=='boolean'||RECORD.includes(k)&&(decomp||manip))fail();return k==='sudden'?6:k==='g2'?3-Number(manip):k==='g3'?3-Number(decomp)-Number(manip):3}
export function judgeTask(k,t){
 if(!t||!validNumber(k,t.n)||typeof t.decomp!=='boolean'||typeof t.manip!=='boolean'||Object.keys(t).some(x=>!['n','decomp','manip','measure','ticks','calc','place'].includes(x)))fail();
 const record=RECORD.includes(k),geo=GEO.includes(k)||record,measure=k==='g3'||record;
 if((k==='even'||record)&&(t.decomp||t.manip)||t.decomp&&t.n%10===0||t.manip&&t.n%10!==0&&!t.decomp)fail();
 let first=true,done=true;
 function stage(values,expected){
  if(!done){if(values!=null)fail();return}
  if(!Array.isArray(values)||!values.length||values.some(v=>!int(v,0,1000000))||values.slice(0,-1).includes(expected)||record&&values.length!==1)fail();
  first=first&&values[0]===expected;done=values.at(-1)===expected;
  if(!done&&!record)fail();
 }
 if(measure){
  if(!Array.isArray(t.measure)||!Array.isArray(t.ticks)||t.measure.length!==t.ticks.length)fail();
  stage(t.measure.map((v,i)=>{if(!int(v,0,1000000)||!int(t.ticks[i],0,200))fail();return v===t.n&&t.ticks[i]===t.n?t.n:1000000}),t.n);
 }else if(t.measure!=null||t.ticks!=null)fail();
 stage(t.calc,t.n/2);if(geo)stage(t.place,t.n/2);else if(t.place!=null)fail();
 return {first,done,clean:!t.decomp&&!t.manip,points:geo&&first&&done?segmentPoints(k,t.decomp,t.manip):0};
}
export function judgeSeries(k,tasks){
 const spec=LEVELS[k];if(!spec||!Array.isArray(tasks)||tasks.length!==spec.n||new Set(tasks.map(t=>t.n)).size!==tasks.length||k==='mix'&&tasks.filter(t=>t.n%20===0).length!==5)fail();
 const a=tasks.map(t=>judgeTask(k,t)),first=a.filter(t=>t.first).length;
 return {kind:k,first,total:spec.n,percent:Math.round(first/spec.n*100),clean:a.every(t=>t.clean),points:a.reduce((s,t)=>s+t.points,0)};
}
export function judgeRecord(k,tasks,completed=true){
 if(!RECORD.includes(k)||!Array.isArray(tasks)||!tasks.length||typeof completed!=='boolean')fail();
 let good=0,errors=0,limit=k==='sudden'?1:3;
 for(const t of tasks){if(errors>=limit)fail();const j=judgeTask(k,t);if(j.first&&j.done)good++;else errors++}
 if(completed?errors!==limit:errors>=limit)fail();return {kind:k,good,errors,points:good*segmentPoints(k),completed};
}
export const initialState=()=>({levels:{},records:{sudden:0,lives:0},recordCounts:{sudden:0,lives:0},rights:{},cups:{},epoch:0});
export const passing=(s,k)=>(s.levels[k]||[]).filter(x=>x.percent>=80).length>=LEVELS[k].p;
export const cleanPerfect=(s,k)=>(s.levels[k]||[]).filter(x=>x.percent===100&&x.clean).length>=LEVELS[k].p;
export const challengesOpen=s=>ORDER.every(k=>passing(s,k));
export const canPlay=(s,k)=>RECORD.includes(k)?challengesOpen(s):ORDER.includes(k)&&(k===ORDER[0]||passing(s,ORDER[ORDER.indexOf(k)-1]));
export const xpTotal=s=>Object.values(s.rights).reduce((a,b)=>a+b,0);
// Call only with a judgement derived on the server and after transactional
// verification of the approved identity, event id, revision and reset epoch.
export function applyJudgement(old,j){
 const s=clone(old),before=xpTotal(s);if(!canPlay(s,j.kind))throw Error('activity_locked');
 const award=(key,v)=>{s.rights[key]=Math.max(s.rights[key]||0,v)};
 const k=j.kind;
 if(RECORD.includes(k)){
  if(!j.completed)return {state:s,xpDelta:0};
  s.records[k]=Math.max(s.records[k],j.points);s.recordCounts[k]=Math.max(s.recordCounts[k],j.good);
  for(const t of THRESHOLDS)if(j.good>=t){award('record:'+t,24);if(k==='sudden')s.cups['sudden'+t]=true}
 }else{
  const spec=LEVELS[k],rows=[...(s.levels[k]||[]),{percent:j.percent,clean:j.clean,points:j.points}];
  rows.sort((a,b)=>b.percent-a.percent||Number(b.clean)-Number(a.clean)||b.points-a.points);
  s.levels[k]=rows.slice(0,spec.p);
  for(let i=0;i<s.levels[k].filter(x=>x.percent>=80).length;i++)award(k+':pass'+(i+1),spec.xp[i]);
  if(j.percent===100&&j.clean)award(k+':perfect',spec.xp.at(-1));
  if(GEO.includes(k)){if(GEO.every(x=>cleanPerfect(s,x)))s.cups.segments=true}
  else if(cleanPerfect(s,k))s.cups[k]=true;
 }
 if(xpTotal(s)>XP_MAX)throw Error('xp_cap');return {state:s,xpDelta:xpTotal(s)-before};
}
export function resetProgression(old,scope){
 if(!['all','geometry'].includes(scope))throw Error('invalid_scope');
 const archive=clone(old),state=clone(old);if(scope==='all')state.levels={};else for(const k of GEO)delete state.levels[k];
 state.records={sudden:0,lives:0};state.recordCounts={sudden:0,lives:0};state.epoch++;
 return {archive,state}; // Permanent trophies and XP rights untouched.
}
