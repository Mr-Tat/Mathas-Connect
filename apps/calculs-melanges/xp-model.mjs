// Mélange : barème de base 594 XP validé par l'enseignant, 9 jalons par niveau.
// Trois opérations sélectionnées au départ = 100%, même en cas de tirage chanceux.
// Une = 25%, deux = 50%, avec compléments plafonnés au droit complet.
// Simulation locale uniquement. Attribution réelle exclusivement côté PostgreSQL.
export const RULES=Object.freeze({perfect4:28,pass10:38,bonus10:8,pass20:63,bonus20:13,sudden5:12,sudden10:12,hard3:12,hard7:12});
// Keep integer XP: 16/20 gives 32, then 20/20 adds 6 (38 = half of 76).
// HARD natively selects all three operations; its half tier is not launchable.
export const HALF_RULES=Object.freeze({perfect4:14,pass10:19,bonus10:4,pass20:32,bonus20:6,sudden5:6,sudden10:6,hard3:6,hard7:6});
// Cumulative rounding: /10 perfect totals 12, /20 perfect totals 19.
export const QUARTER_RULES=Object.freeze({perfect4:7,pass10:10,bonus10:2,pass20:16,bonus20:3,sudden5:3,sudden10:3,hard3:3,hard7:3});
export const XP_POLICY_VERSION=3;
export const MAX_XP=3*Object.values(RULES).reduce((a,b)=>a+b,0);
export function milestones(records){
 const found=new Map();
 function collect(state,rules){
 for(let level=1;level<=3;level++){
  const i=level-1,classic=state?.classic?.[i]??{},sudden=state?.sudden?.[i]??0,hard=state?.hard?.[i]??0;
  const add=(key,pts)=>found.set(key,Math.max(found.get(key)??0,pts));
  if(classic[4]===4)add(`classic:${level}:4:perfect`,rules.perfect4);
  if(classic[10]>=8)add(`classic:${level}:10:pass`,rules.pass10);
  if(classic[10]===10)add(`classic:${level}:10:bonus`,rules.bonus10);
  if(classic[20]>=16)add(`classic:${level}:20:pass`,rules.pass20);
  if(classic[20]===20)add(`classic:${level}:20:bonus`,rules.bonus20);
  if(state?.thresholds?.sudden?.[i]?.[5]===true)add(`sudden:${level}:5`,rules.sudden5);
  if(state?.thresholds?.sudden?.[i]?.[10]===true)add(`sudden:${level}:10`,rules.sudden10);
  if(state?.thresholds?.hard?.[i]?.[3]===true)add(`hard:${level}:3`,rules.hard3);
  if(state?.thresholds?.hard?.[i]?.[7]===true)add(`hard:${level}:7`,rules.hard7);
 }
 }
 collect(records?.quarterEligible,QUARTER_RULES);collect(records?.halfEligible,HALF_RULES);collect(records?.eligible,RULES);
 return {keys:[...found.keys()].sort(),xp:[...found.values()].reduce((a,b)=>a+b,0),points:Object.fromEntries([...found].sort())};
}
