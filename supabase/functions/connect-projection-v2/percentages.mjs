// Statistiques pédagogiques sur des PARTIES TERMINÉES enregistrées.
 // La télémétrie par exercice (y compris partie abandonnée) reste à intégrer.
const integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const rate=(correct,attempted)=>attempted>0?Math.round(correct*1000/attempted)/10:null;

// Les entrées proviennent d'un SQL GROUP BY classe/application, pas d'un
// classement de scores, ni du nombre de trophées ou d'XP.
export function summarizeCompletedGames(rows,{classId,appKeys=[],globalKeys=appKeys}={}){
 const keys=[...new Set(appKeys.filter(k=>typeof k==='string'))];
 const map=new Map(keys.map(k=>[k,{correct:0,attempted:0}]));
 for(const row of Array.isArray(rows)?rows:[]){
  if(row?.class_id!==classId||!map.has(row.app_key))continue;
  const correct=Number(row.correct),attempted=Number(row.attempted);
  if(!integer(correct)||!integer(attempted)||attempted===0||correct>attempted)continue;
  const totals=map.get(row.app_key);
  totals.correct+=correct;totals.attempted+=attempted;
 }
 const apps={},counts={};
 for(const [key,totals] of map){
  apps[key]=rate(totals.correct,totals.attempted);
  counts[key]={...totals};
 }
 const included=new Set(globalKeys);
 let correct=0,attempted=0;
 for(const [key,totals] of map)if(included.has(key)){
  correct+=totals.correct;attempted+=totals.attempted;
 }
 return {global:rate(correct,attempted),apps,counts};
}
