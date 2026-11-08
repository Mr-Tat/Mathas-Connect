// Daily scoreboard calculations for the secured teacher-only projection.
// Only explicitly shared, server-captured events can reach the projector.
// The historical "best score" ledger and its manual publication are untouched.
const belgianClock=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'
});
export function brusselsDayKey(value){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 const parts=Object.fromEntries(belgianClock.formatToParts(date).map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
export function brusselsDaySearchWindow(nowMs=Date.now()){
 const day=brusselsDayKey(nowMs);
 if(!day)throw Error('invalid_date');
 const [year,month,date]=day.split('-').map(Number);
 // Conservative UTC window around Belgian local midnight (CET and CEST);
 // exact local calendar-day filtering is enforced on every event below.
 const start=new Date(Date.UTC(year,month-1,date)-2*3600000).toISOString();
 const end=new Date(Date.UTC(year,month-1,date+1)+2*3600000).toISOString();
 return {day,start,end};
}
const key=(classId,studentId,appKey)=>[classId,studentId,appKey].join('|');
const eventKey=e=>[e.student_id,e.class_id,e.app_key,e.event_id].join('|');
/** @param {{events?:any[],consents?:any[],periods?:any[],nowMs?:number}} input */
export function summarizeDailyPublishedScores({events=[],consents=[],periods=[],nowMs=Date.now()}={}){
 const today=brusselsDayKey(nowMs),byPeriod=new Map();
 for(const period of periods){
  const since=Date.parse(period?.score_since);
  if(Number.isFinite(since))byPeriod.set([period.class_id,period.app_key].join('|'),since);
 }
 const shared=new Set(consents.map(eventKey));
 const winners=new Map();
 for(const e of events){
  if(!e||!shared.has(eventKey(e))||brusselsDayKey(e.played_at)!==today)continue;
  const played=Date.parse(e.played_at),captured=Date.parse(e.captured_at);
  if(!Number.isFinite(played)||!Number.isFinite(captured)||played>nowMs+300000)continue;
  const period=byPeriod.get([e.class_id,e.app_key].join('|'));
  if(period!==undefined&&(played<period||captured<period))continue;
  const points=Number(e.game_points)>0?Number(e.game_points):Number(e.game_score);
  if(!Number.isSafeInteger(points)||points<0)continue;
  const identity=key(e.class_id,e.student_id,e.app_key);
  const previous=winners.get(identity);
  if(previous===undefined||points>previous)winners.set(identity,points);
 }
 return winners;
}
export function publishedScoreKey(classId,studentId,appKey){
 return key(classId,studentId,appKey);
}
