// Fusion locale des scores classiques lors du passage à la nouvelle interface.
// Ne communique jamais avec Connect/Supabase ; aucune suppression des données historiques.
const KEYS={
 classic:'addition_classic_v1',sudden:'addition_sudden_v1',hard:'addition1_hard_sudden_v1',
 hardThree:'addition1_hard_three_v1',progress:'mathas_progression_addition_simple_v1',
 points:'mathas_points_v1_addition-simple',rewards:'mathas_trophies_v3_addition-simple',
 lastWork:'addition1_last_work',ruler:'addition_ruler_usage_v1'
};
const FLAGS=['level2','level3','sudden1','sudden2','sudden3','perfect1','perfect2','perfect3','hard'];
const levels=[3,5,7],lengths=[4,10,20],colors=['bronze','silver','gold'];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const valid=(v,lim=100000)=>v!=null&&v!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=lim;
const take=(v,lim)=>valid(v,lim)?Number(v):null;
const arr3=(x,max)=>levels.map((_,i)=>take(object(x)[String(i+1)],max));
function rewards(value){
 const x=object(value),out={version:3,mastery:{},sudden:[false,false,false],hardAwards:{},scoreOne:{},unlockedGold:x.unlockedGold===true};
 for(const len of lengths)out.mastery[len]=levels.map((_,i)=>x.mastery?.[len]?.[i]===true);
 for(let i=0;i<3;i++)out.sudden[i]=x.sudden?.[i]===true;
 for(const color of colors){
  out.scoreOne[color]=x.scoreOne?.[color]===true;
  out.hardAwards[color]=levels.map((_,i)=>x.hardAwards?.[color]?.[i]===true);
 }
 return out;
}
const rewardMerge=(x,y)=>{
 const a=rewards(x),b=rewards(y);
 for(const len of lengths)for(let i=0;i<3;i++)a.mastery[len][i]||=b.mastery[len][i];
 for(let i=0;i<3;i++)a.sudden[i]||=b.sudden[i];
 for(const c of colors){a.scoreOne[c]||=b.scoreOne[c];for(let i=0;i<3;i++)a.hardAwards[c][i]||=b.hardAwards[c][i]}
 a.unlockedGold||=b.unlockedGold;return a;
};
const max=(a,b,limit)=>{const x=take(a,limit),y=take(b,limit);return x==null?y:y==null?x:Math.max(x,y)};
const mergeScores=(a,b)=>{const out={};for(const level of levels){const row={};for(const n of lengths){const v=max(object(a)[level]?.[n],object(b)[level]?.[n],n);if(v!=null)row[n]=v}if(Object.keys(row).length)out[level]=row}return out};
const mergeSequence=(a,b,keys,limit)=>{const out={};for(const k of keys){const n=max(object(a)[k],object(b)[k],limit);if(n!=null)out[k]=n}return out};
const mergeProgress=(a,b)=>{const out={};for(const k of FLAGS)out[k]=object(a)[k]===true||object(b)[k]===true;return out};
function cleanPoints(v){return valid(v,10000000)?Number(v):null}
function mergePoints(a,b){
 const x=object(a),y=object(b),p=v=>object(v);
 const pick=(v,w)=>cleanPoints(v?.points)>=cleanPoints(w?.points)?v:w;
 const best=pick(p(x.bestOne),p(y.bestOne));
 const validRows=[...(Array.isArray(x.bestThree)?x.bestThree:[]),...(Array.isArray(y.bestThree)?y.bestThree:[])].filter(r=>cleanPoints(r?.points)!=null);
 const bestThree=validRows.sort((a,b)=>b.points-a.points).filter((r,i,all)=>all.findIndex(z=>z.at===r.at&&z.label===r.label&&z.points===r.points)===i).slice(0,3);
 const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'});
 const today=[...(x.day===now&&Array.isArray(x.top)?x.top:[]),...(y.day===now&&Array.isArray(y.top)?y.top:[])].filter(r=>cleanPoints(r?.points)!=null).sort((a,b)=>b.points-a.points).slice(0,3);
 return {version:1,day:now,top:today,bestOne:cleanPoints(best?.points)!=null?best:null,bestThree};
}
function readObject(read,key){try{return JSON.parse(read(key)||'null')}catch{return null}}
export function legacySnapshot(read){
 const entries={};let found=0;for(const [name,k]of Object.entries(KEYS)){entries[name]=readObject(read,k);if(entries[name]!=null)found++}
 if(!entries.rewards)entries.rewards=readObject(read,'mathas_trophies_v2_addition-simple')||readObject(read,'mathas_trophies_v1_addition-simple');
 const history=readObject(read,'mathas_scores_/addition-ecrite-simple/');
 const meaningful=Object.entries(object(entries.classic)).length+
  Object.entries(object(entries.sudden)).length+Object.entries(object(entries.hard)).length+
  Object.entries(object(entries.hardThree)).length+
  Number(Object.values(object(entries.progress)).some(Boolean))+
  Number(cleanPoints(entries.points?.bestOne?.points)!=null)+Number(!!entries.rewards);
 return {entries,found,meaningful,history};
}
export function importToClassic(snapshot,read,write){
 const e=snapshot.entries;
 const get=k=>readObject(read,k);
 const set=(k,v)=>write(k,JSON.stringify(v));
 const classic=mergeScores(get(KEYS.classic),e.classic);set(KEYS.classic,classic);
 const sudden=mergeSequence(get(KEYS.sudden),e.sudden,levels,100000);set(KEYS.sudden,sudden);
 const hard=mergeSequence(get(KEYS.hard),e.hard,[1,2,3],100000);set(KEYS.hard,hard);
 const hardThree=mergeSequence(get(KEYS.hardThree),e.hardThree,[1,2,3],5);set(KEYS.hardThree,hardThree);
 set(KEYS.progress,mergeProgress(get(KEYS.progress),e.progress));
 set(KEYS.points,mergePoints(get(KEYS.points),e.points));
 if(e.rewards)set(KEYS.rewards,rewardMerge(get(KEYS.rewards),e.rewards));
 const last=get(KEYS.lastWork),incoming=e.lastWork;
 if(incoming&&(!last||(Date.parse(incoming.at)||0)>(Date.parse(last.at)||0)))set(KEYS.lastWork,incoming);
 return {classic,sudden,hard,hardThree};
}
