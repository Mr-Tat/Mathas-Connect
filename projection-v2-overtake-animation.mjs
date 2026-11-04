import {playerKey} from './projection-v2-overtakes.mjs';

// Visible, one-rank-at-a-time FLIP animation. No polling or database writes.
const DURATION=550;
const SPARKLE_DURATION=850;
const prefersLessMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

async function swapPair({actor,passed,beforeActor,beforePassed,canContinue}){
 if(!actor||!passed||prefersLessMotion())return true;
 const afterActor=actor.getBoundingClientRect(),afterPassed=passed.getBoundingClientRect();
 const move=(node,from,to,enlarge)=>{
  const dx=from.left-to.left,dy=from.top-to.top;
  const keyframes=[
   {transform:'translate('+dx+'px,'+dy+'px) scale(1)',offset:0},
   {transform:'translate('+(dx*.45)+'px,'+(dy*.45)+'px) scale('+enlarge+')',offset:.53},
   {transform:'translate(0,0) scale(1)',offset:1}
  ];
  return node.animate(keyframes,{duration:DURATION,
   easing:'cubic-bezier(.22,.76,.23,1)',fill:'both'});
 };
 actor.style.zIndex='8';passed.style.zIndex='2';
 const a=move(actor,beforeActor,afterActor,1.12);
 const b=move(passed,beforePassed,afterPassed,.90);
 await Promise.all([a.finished.catch(()=>{}),b.finished.catch(()=>{})]);
 a.cancel();b.cancel();
 actor.style.zIndex='';passed.style.zIndex='';
 return canContinue();
}
export function sprinkleArrival(row){
 if(!row||prefersLessMotion())return;
 const halo=document.createElement('span');halo.className='rank-arrival-sparkles';
 halo.setAttribute('aria-hidden','true');
 const marks=[[-33,-27],[-12,-39],[21,-31],[44,-6],[31,25],[-24,26],[6,38]];
 for(const [i,[x,y]] of marks.entries()){
  const bit=document.createElement('i');
  bit.textContent=i%3===0?'✦':'✧';
  bit.style.setProperty('--spark-x',x+'px');
  bit.style.setProperty('--spark-y',y+'px');
  bit.style.animationDelay=i*35+'ms';
  halo.append(bit);
 }
 row.append(halo);
 setTimeout(()=>halo.remove(),SPARKLE_DURATION+260);
}
export async function animateOvertakeSegment({segment,paint,findRow,canContinue,onStep,onArrival}){
 if(!canContinue())return false;
 let order=segment.from.rows.map(p=>{
  const updated=segment.to.rows.find(next=>playerKey(next)===playerKey(p));
  return updated?{...p,score:updated.score,level:updated.level,
   trophies:updated.trophies,name:updated.name,avatar:updated.avatar}:p;
 });
 paint(order);
 for(const movement of segment.moves){
  let i=order.findIndex(p=>playerKey(p)===movement.key);
  const dest=movement.toIndex??movement.toRank-1;
  if(i<0||i<=dest)continue;
  while(i>dest){
   if(!canContinue())return false;
   const passedKey=playerKey(order[i-1]),actorKey=movement.key;
   const actorBefore=findRow(actorKey)?.getBoundingClientRect();
   const passedBefore=findRow(passedKey)?.getBoundingClientRect();
   [order[i-1],order[i]]=[order[i],order[i-1]];
   paint(order);
   const actor=findRow(actorKey),passed=findRow(passedKey);
   if(actorBefore&&passedBefore){
    const ok=await swapPair({actor,passed,beforeActor:actorBefore,
     beforePassed:passedBefore,canContinue});
    if(!ok)return false;
   }
   onStep?.(actorKey,passedKey);
   i--;
  }
 }
 if(!canContinue())return false;
 paint(segment.to.rows);
 for(const movement of segment.moves){
  if(!canContinue())return false;
  sprinkleArrival(findRow(movement.key));
  onArrival?.(movement);
 }
 return true;
}
