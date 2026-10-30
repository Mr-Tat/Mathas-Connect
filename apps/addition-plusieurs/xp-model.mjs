// Addition multiple: 9 jalons par niveau, mêmes événements vérifiés que le moteur simple.
// Simulation locale uniquement. Attribution réelle exclusivement côté PostgreSQL.
export const RULES=Object.freeze({perfect4:22,pass10:30,bonus10:6,pass20:50,bonus20:10,sudden5:10,sudden10:10,hard3:10,hard7:10});
export const MAX_XP=3*Object.values(RULES).reduce((a,b)=>a+b,0);
export function milestones(state){
 const found=new Map();
 for(let level=1;level<=3;level++){
  const i=level-1,classic=state?.classic?.[i]??{},sudden=state?.sudden?.[i]??0,hard=state?.hard?.[i]??0;
  const add=(key,pts)=>found.set(key,pts);
  if(classic[4]===4)add(`classic:${level}:4:perfect`,RULES.perfect4);
  if(classic[10]>=8)add(`classic:${level}:10:pass`,RULES.pass10);
  if(classic[10]===10)add(`classic:${level}:10:bonus`,RULES.bonus10);
  if(classic[20]>=16)add(`classic:${level}:20:pass`,RULES.pass20);
  if(classic[20]===20)add(`classic:${level}:20:bonus`,RULES.bonus20);
  if(sudden>=5)add(`sudden:${level}:5`,RULES.sudden5);
  if(sudden>=10)add(`sudden:${level}:10`,RULES.sudden10);
  if(hard>=3)add(`hard:${level}:3`,RULES.hard3);
  if(hard>=7)add(`hard:${level}:7`,RULES.hard7);
 }
 return {keys:[...found.keys()].sort(),xp:[...found.values()].reduce((a,b)=>a+b,0)};
}
