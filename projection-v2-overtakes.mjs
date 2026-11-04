import {withScoreTies} from './projection-v2-model.mjs';

// Projection V2 — deterministic per-application movement queue.
// Uses only the already-published, professor-authorized leaderboard snapshots.
export const playerKey=p=>String(p?.classId||'')+'|'+String(p?.id||'');
const safeRankScore=p=>Number.isFinite(p?.score)?p.score:null;
const sameSet=(a,b)=>{
 if(a.length!==b.length)return false;
 const names=new Set(a.map(playerKey));
 return names.size===a.length&&b.every(p=>names.has(playerKey(p)));
};
const sameRows=(a,b)=>a.length===b.length&&a.every((p,i)=>{
 const q=b[i];
 return playerKey(p)===playerKey(q)&&p.name===q.name&&p.level===q.level
  &&p.trophies===q.trophies&&safeRankScore(p)===safeRankScore(q)
  &&JSON.stringify(p.avatar??null)===JSON.stringify(q.avatar??null);
});
export function detectOvertakes(before,after){
 if(!before?.rows||!after?.rows||before.context!==after.context
  ||!sameSet(before.rows,after.rows))return [];
 const oldPositions=new Map(before.rows.map((p,i)=>[playerKey(p),{index:i,person:p}]));
 const oldRanks=new Map(withScoreTies(before.rows).map(p=>[playerKey(p),p.position]));
 const newRanks=new Map(withScoreTies(after.rows).map(p=>[playerKey(p),p.position]));
 return after.rows.flatMap((person,to)=>{
  const previous=oldPositions.get(playerKey(person));
  if(!previous||previous.index<=to
   ||safeRankScore(person)===null||safeRankScore(previous.person)===null
   ||person.score<=previous.person.score)return [];
  // Animation: indices physiques. Exploit: rangs des scores distincts.
  const key=playerKey(person),fromRank=oldRanks.get(key),toRank=newRanks.get(key);
  return [{key,appKey:after.appKey,name:person.name,
   fromRank,toRank,fromIndex:previous.index,toIndex:to,
   oldScore:previous.person.score,newScore:person.score,
   gained:Math.max(0,fromRank-toRank)}];
 }).sort((a,b)=>a.toIndex-b.toIndex||b.fromIndex-a.fromIndex||a.key.localeCompare(b.key));
}
export function createOvertakeTracker(){
 const seen=new Map(),shown=new Map(),queued=new Map();
 function observe(snapshot){
  const key=snapshot.appKey,previous=seen.get(key);
  seen.set(key,snapshot);
  if(!previous||previous.context!==snapshot.context||!sameSet(previous.rows,snapshot.rows)){
   queued.delete(key);shown.set(key,snapshot);
   return {reset:true,count:0};
  }
  if(sameRows(previous.rows,snapshot.rows))return {reset:false,count:0};
  const moves=detectOvertakes(previous,snapshot);
  const queue=queued.get(key)||[];
  if(moves.length||queue.length){
   queue.push({from:previous,to:snapshot,moves});
   queued.set(key,queue);
  }else shown.set(key,snapshot);
  return {reset:false,count:moves.length};
 }
 function take(key){
  return queued.get(key)?.[0]||null;
 }
 function finish(key,segment){
  const queue=queued.get(key);
  if(!queue||queue[0]!==segment)return false;
  queue.shift();if(!queue.length)queued.delete(key);
  shown.set(key,segment.to);return true;
 }
 return {
  observe,take,finish,
  shown:key=>shown.get(key)||null,
  pending:key=>(queued.get(key)||[]).length,
  clear(){seen.clear();shown.clear();queued.clear()},
  drop:key=>{seen.delete(key);shown.delete(key);queued.delete(key)},
  keys:()=>[...seen.keys()]
 };
}
