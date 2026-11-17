// Shared proof validation, executed by the server before its atomic RPC.
// No XP amount, trophy flag or native local-storage snapshot is accepted.
export const APP_KEY='abaque-longueurs';
export const VERSION=4; // V1/V2/V3 restent immuables pour les reçus et preuves en attente.
export const MAX_TASKS=20;
// The first ten successful record conversions carry arithmetic proofs. Later
// successes cannot earn any extra XP; run-length segments keep their native
// points/records exact without growing a proof array or imposing a game cap.
export function recordPoints(kind,count,version=VERSION){
 if(!Number.isSafeInteger(count)||count<0||![1,2,3,4].includes(version)||!['lives','sudden'].includes(kind))fail();
 // Après 10 réussites, toutes les aides sont désactivées : pas de preuve détaillée supplémentaire.
 return count*(version===1?(kind==='sudden'?2:1):(kind==='sudden'?6:3));
}
export function conversionPoints(kind,{manip=false,units=false}={},version=VERSION){
 if(!['one','three','five','lives','sudden'].includes(kind)||![2,3,4].includes(version))fail();
 // V3 : en 1 page, la manipulation de la virgule est automatique et gratuite.
 // Seul l'abaque coûte 1 point (3 -> 2), les autres modes conservent 3/2/1.
 if(version===4){
  // V4 : prix progressifs, aides indépendantes. Les modes records conservent 3/2/1.
  const base=kind==='one'?3:kind==='three'?(manip?2:3):kind==='five'?
    3-Number(units)-2*Number(manip):(units?1:manip?2:3);
  return base*(kind==='sudden'?2:1);
 }
 return (version===3&&kind==='one'?(units?2:3):(units?1:manip?2:3))*(kind==='sudden'?2:1);
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allUnits=['km','hm','dam','m','dm','cm','mm'];
const choices=['km','m','cm','mm'];
const images={ant:'mm',coin:'mm',rice:'mm',pencil:'mm',card:'mm',phone:'cm',shoe:'cm',brush:'cm',paperclip:'cm',spoon:'cm',bottle:'cm',pencilcase:'cm',car:'m',door:'m',bike:'m',bed:'m',sofa:'m',student:'m','verviers-liege':'km','verviers-spa':'km','liege-bruxelles':'km',hike:'km',train:'km',villages:'km'};
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const fail=()=>{throw Error('invalid_completion')};
function conversion(task,version){
 if(!object(task)||!choices.includes(task.from)||!choices.includes(task.to)||task.from===task.to||
  !integer(task.source,1,9999999)||!integer(task.answer,0,9999999999999)||
  typeof task.manip!=='boolean'||typeof task.units!=='boolean'||(version<4&&task.units&&!task.manip))fail();
 const shift=allUnits.indexOf(task.to)-allUnits.indexOf(task.from);
 if(task.source>10**(allUnits.indexOf(task.from)+1)-1)fail();
 const expected=shift>=0?task.source*10**shift:task.source/10**(-shift);
 if(!integer(expected,1,9999999))fail();
 if(task.correctedAnswer!=null&&!integer(task.correctedAnswer,0,9999999999999))fail();
 return {good:task.answer===expected,corrected:task.correctedAnswer===expected,manip:task.manip,units:task.units};
}
export function judgeCompletion(raw){
 if(!object(raw)||![1,2,3,VERSION].includes(raw.version)||!UUID.test(raw.eventId)||!integer(raw.expectedResetEpoch,0,Number.MAX_SAFE_INTEGER)||!((raw.completed===true&&raw.abandoned!==true)||(raw.completed===false&&raw.abandoned===true))||raw.master!==false||
  ['xp','trophies','state','studentId','points','firstTry','assisted'].some(key=>Object.hasOwn(raw,key)))fail();
 const kind=raw.kind;
 if(raw.completed===false&&!['lives','sudden'].includes(kind))fail();
 let firstTry=0,points=0,total=0,successes=0,errors=0,assisted=false;
 const resultDots=[];
 if(kind==='build'){
  if(!Array.isArray(raw.units)||raw.units.length!==4||!Array.isArray(raw.images)||raw.images.length!==8)fail();
  if(new Set(raw.units.map(x=>x?.unit)).size!==4||new Set(raw.images.map(x=>x?.image)).size!==8)fail();
  for(const item of raw.units){if(!object(item)||!choices.includes(item.unit)||!allUnits.includes(item.placed))fail();firstTry+=Number(item.unit===item.placed)}
  for(const item of raw.images){if(!object(item)||!Object.hasOwn(images,item.image)||!choices.includes(item.placed))fail();firstTry+=Number(images[item.image]===item.placed)}
  total=12;
 }else if(kind==='moves'){
  if(!Array.isArray(raw.tasks)||raw.tasks.length!==8)fail();
  for(const task of raw.tasks){
   if(!object(task)||!choices.includes(task.from)||!choices.includes(task.to)||task.from===task.to||!integer(task.answer,-6,6))fail();
   firstTry+=Number(task.answer===allUnits.indexOf(task.to)-allUnits.indexOf(task.from));
  }
  total=8;
 }else if(['one','three','five','lives','sudden'].includes(kind)){
  const record=kind==='lives'||kind==='sudden';
  const expectedCount={one:4,three:12,five:20}[kind];
  if(!Array.isArray(raw.tasks)||raw.tasks.length<1||raw.tasks.length>MAX_TASKS||(!record&&raw.tasks.length!==expectedCount))fail();
  for(const [index,task] of raw.tasks.entries()){
   const judged=conversion(task,raw.version);
   if(raw.version>=2&&(raw.version===3&&kind==='one'?judged.units:(judged.manip||judged.units)))assisted=true;
   if(record){
    if(errors===(kind==='lives'?3:1)||task.correctedAnswer!=null||
     (successes>=1&&judged.units)||(successes>=3&&judged.manip))fail();
    if(judged.good){
     points+=raw.version===1?(kind==='sudden'?2:1):conversionPoints(kind,judged,raw.version);
     successes++;
    }else errors++;
   }else{
    // Les conversions corrigées rapportent 0 point ; les aides sont facturées au premier essai.
    if(judged.good){firstTry++;points+=raw.version===1?2:conversionPoints(kind,judged,raw.version);}
    if(raw.version>=2)resultDots.push(!judged.good?'red':judged.units?'purple':judged.manip?'blue':'green');
   }
  }
  if(record&&raw.tailSegments!=null){
   if(successes<10||!Array.isArray(raw.tailSegments)||raw.tailSegments.length<1||raw.tailSegments.length>4||raw.tailSegments.some(n=>!integer(n,0,Number.MAX_SAFE_INTEGER)))fail();
   const extra=raw.tailSegments.reduce((a,b)=>a+b,0);
   const extraErrors=raw.tailSegments.length-1;
   if(!Number.isSafeInteger(successes+extra)||errors+extraErrors>(kind==='lives'?3:1))fail();
   points+=recordPoints(kind,successes+extra,raw.version)-recordPoints(kind,successes,raw.version);
   successes+=extra;errors+=extraErrors;
  }
  if(record){
   const limit=kind==='lives'?3:1;
   const endsInError=raw.tailSegments!=null?raw.tailSegments.length>1&&raw.tailSegments.at(-1)===0:!conversion(raw.tasks.at(-1),raw.version).good;
   if(raw.completed?(errors!==limit||!endsInError):errors>=limit)fail();
   firstTry=successes;
  }
  total=record?successes+errors:expectedCount;
 }else fail();
 if(!integer(points,0,Number.MAX_SAFE_INTEGER))fail();
 // Préserver exactement le jugement V1 pour les preuves anciennes en attente et les accusés idempotents.
 return Object.freeze({eventId:raw.eventId.toLowerCase(),kind,firstTry,total,points,successes,errors,eligible:raw.completed,ruleset:raw.version,
  ...(raw.version>=2?{assisted,...(resultDots.length?{resultDots}:{} )}:{} ),
  ...(raw.version>=3?{cleanPerfect:!assisted&&['one','three','five'].includes(kind)&&firstTry===total,
    cleanRecord:!assisted&&kind==='sudden'}:{})});
}
