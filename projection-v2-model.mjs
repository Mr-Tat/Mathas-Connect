// Pure presentation model. Auth and data retrieval belong to protected endpoints.
// Scores are game-native values; never combine points from unrelated applications.
// This module performs no writes and cannot reset persisted results or XP.
const numeric=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const time=x=>{const n=Date.parse(x||'');return Number.isFinite(n)?n:null};
const validClass=x=>typeof x==='string'&&x.length>0;
const validApp=x=>typeof x==='string'&&x.length>0;

// Un rang par score distinct, même pour les élèves séparés en deux colonnes.
// Exemple : scores 150, 150, 130, 110 => rangs 1, 1, 2, 3.
export function withScoreTies(rows=[]){
 const list=Array.isArray(rows)?rows:[];
 const values=[...new Set(list.filter(p=>numeric(p?.score)).map(p=>p.score))]
  .sort((a,b)=>b-a);
 const ranks=new Map(values.map((score,i)=>[score,i+1]));
 return list.map((person,index)=>({...person,
  position:numeric(person?.score)?ranks.get(person.score):index+1}));
}

export function rankApplication({students=[],events=[],classId,appKey,since,includeTeacher=false}={}){
 if(!validClass(classId)||!validApp(appKey))return [];
 const started=time(since);
 if(started===null)return [];
 const best=new Map();
 for(const e of events){
  if(e?.classId!==classId||e.appKey!==appKey||typeof e.studentId!=='string'||!numeric(e.value))continue;
  const at=time(e.at);if(at===null||at<started)continue;
  const previous=best.get(e.studentId);
  if(previous===undefined||e.value>previous)best.set(e.studentId,e.value);
 }
 const eligible=Array.isArray(students)?students:[];
 const sorted=eligible.filter(s=>s&&s.classId===classId&&(!s.isTeacher||includeTeacher)&&s.visible!==false)
  .map(s=>({id:s.id,name:String(s.publicName||'Élève').slice(0,80),level:numeric(s.level)?s.level:null,
   trophies:numeric(s.trophies)?s.trophies:null,score:best.get(s.id)??null}))
  .sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name,'fr')||a.id.localeCompare(b.id));
 return withScoreTies(sorted);
}

export function splitRanking(rows=[]){
 if(!Array.isArray(rows))return [[]];
 const top=rows.slice(0,14);
 if(top.length<=7)return [top];
 const halfway=Math.ceil(top.length/2);
 return [top.slice(0,halfway),top.slice(halfway)];
}

export function classScore(rows=[]){
 return rows.reduce((sum,person)=>sum+(numeric(person.score)?person.score:0),0);
}

// Each question/exercise carries a stable id. A started but not successfully
// completed exercise contributes to the denominator, not the numerator.
// This requires actual per-exercise telemetry, NOT an extrapolation from
// the 3 recent finished sessions stored by old application state.
export function summarizeStartedExercises({events=[],classId,appKeys=[]}={}){
 if(!validClass(classId))return {started:0,correct:0,percentage:null};
 const keys=new Set(appKeys);
 const sessions=new Map();
 for(const e of events){
  if(e?.classId!==classId||!keys.has(e.appKey)||!e.studentId||!e.exerciseId)continue;
  if(e.mode==='sudden'||e.mode==='mort-subite')continue;
  if(e.started!==true&&e.correct!==true)continue;
  const id=[e.studentId,e.appKey,e.exerciseId].join('|');
  const prev=sessions.get(id)||{started:false,correct:false};
  sessions.set(id,{started:prev.started||e.started===true||e.correct===true,correct:prev.correct||e.correct===true});
 }
 let started=0,correct=0;
 for(const s of sessions.values()){if(s.started){started++;if(s.correct)correct++}}
 return {started,correct,percentage:started?Math.round(1000*correct/started)/10:null};
}

// Only the selected (class, application) period advances upon score reset.
// Percentages are deliberately independent and are not reset.
export function resetScorePeriod(periods=[],classId,appKey,when){
 const at=time(when);if(!validClass(classId)||!validApp(appKey)||at===null)throw Error('invalid_period');
 const copy=(Array.isArray(periods)?periods:[]).map(v=>({...v}));
 const index=copy.findIndex(x=>x.classId===classId&&x.appKey===appKey);
 if(index<0)copy.push({classId,appKey,since:when});
 else copy[index]={...copy[index],since:when};
 return copy;
}


// Combine only the class selected for projection and classes explicitly
// checked in the Score column. % comparison choices have no effect here.
export function rankMultiClass({
 classes=[],primaryClassId,scoreClassIds=[],appKey,limit=16,includeTeacher=false,
 scoreField='bestScore'
}={}){
 if(!validClass(primaryClassId)||!validApp(appKey))return [];
 const allowed=new Set([primaryClassId,...(Array.isArray(scoreClassIds)?scoreClassIds:[])]);
 const eligible=[];
 for(const group of Array.isArray(classes)?classes:[]){
  if(!group||!allowed.has(group.classId))continue;
  for(const p of Array.isArray(group.students)?group.students:[]){
   if(!p||p.visible===false||p.isTeacher&&!includeTeacher)continue;
   const row=Array.isArray(p.scores)?p.scores.find(x=>x.appKey===appKey):undefined;
   const selectedField=scoreField==='todayScore'?'todayScore':'bestScore';
   const score=numeric(row?.[selectedField])?row[selectedField]:null;
   // Each game has its own public leaderboard. A student with no published
   // score for THIS app must not appear, even as an unplayed placeholder:
   // otherwise cards from another game seem to carry over.
   if(score===null)continue;
   eligible.push({id:p.id,classId:group.classId,className:group.name,
    name:String(p.name||'Élève').slice(0,80),level:numeric(p.level)?p.level:null,
    trophies:numeric(p.trophies)?p.trophies:null,avatar:p.avatar??null,score});
  }
 }
 const sorted=eligible.sort((a,b)=>(b.score??-1)-(a.score??-1)
  ||a.name.localeCompare(b.name,'fr')||a.className.localeCompare(b.className,'fr')
  ||String(a.id).localeCompare(String(b.id)))
  .slice(0,Math.min(Math.max(0,Number(limit)||16),16));
 return withScoreTies(sorted);
}
export function splitProjectedRanking(rows=[],multiClass=false){
 const data=(Array.isArray(rows)?rows:[]).slice(0,16);
 if(data.length<=8)return [data];
 // Une seule colonne jusqu'à 8 élèves (1 ou 2 applications) ; au-delà, deux colonnes équilibrées.
 const cut=Math.ceil(data.length/2);
 return [data.slice(0,cut),data.slice(cut)];
}
