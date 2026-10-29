// Projection V1 : chiffres collectifs uniquement. Aucune identité en sortie.
const publishedForProjection=new Set(['addition-ecrite-simple','multiplication-ecrite-simple']);
function dayKey(date){
 const d=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(d.getTime()))return '';
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export function summarizeProjection(students,catalog,now=new Date()){
 const people=Array.isArray(students)?students.slice(0,250):[];
 const apps=(Array.isArray(catalog)?catalog:[])
  .filter(a=>a&&publishedForProjection.has(a.app_key)&&a.featured===true)
  .slice(0,8).map(a=>({key:a.app_key,title:String(a.title||'Application').slice(0,100)}));
 const today=dayKey(now);
 const counts=new Map(apps.map(a=>[a.key,{recent:0,today:0}]));
 let participants=0,activeToday=0;
 for(const person of people){
  const states=new Map((Array.isArray(person?.apps)?person.apps:[])
    .filter(a=>a&&publishedForProjection.has(a.appKey))
    .map(a=>[a.appKey,a.state]));
  let participated=false,todayPlayed=false;
  for(const app of apps){
   const recent=Array.isArray(states.get(app.key)?.recent)?states.get(app.key).recent.slice(0,3):[];
   if(recent.length){
    participated=true;counts.get(app.key).recent++;
    if(recent.some(r=>r&&dayKey(r.at)===today)){
     todayPlayed=true;counts.get(app.key).today++;
    }
   }
  }
  if(participated)participants++;
  if(todayPlayed)activeToday++;
 }
 return {total:people.length,participants,activeToday,
  apps:apps.map(a=>({...a,...counts.get(a.key)}))};
}
