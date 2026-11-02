/* Minimal hooks around the preserved engine. No network and no XP calculation. */
(()=>{
 let sink=null,current=null,page=null,epoch=()=>null;
 function finish(completed){
  if(!current||current.sent||!current.tasks?.length&&['lives','sudden'].includes(current.kind))return;
  const master=window.MATHAS_PROGRESS.practice;
  if(!completed&&!['lives','sudden'].includes(current.kind)){current=null;return;}
  const event={...current,completed,master,...(!completed?{abandoned:true}:{})};
  delete event.sent;delete event.prefixSuccesses;current.sent=true;
  if(!master)sink?.(event);
 }
 window.MATHAS_ABAQUE_PROOF=Object.freeze({
  configure(callback,getEpoch){sink=callback;epoch=getEpoch;},
  start(kind){
   current=sink?{version:1,eventId:crypto.randomUUID(),expectedResetEpoch:epoch(),kind,units:[],images:[],tasks:[],prefixSuccesses:0,sent:false}:null;
   page=null;
  },
  units(positions){if(current&&!current.units.length)current.units=['km','m','cm','mm'].map(unit=>({unit,placed:positions[unit]}));},
  images(items,positions){if(current){current.images=items.map(item=>({image:item.id,placed:positions[item.id]}));finish(true);}},
  moves(tasks,answers,done){
   if(current){current.tasks.push(...tasks.map(([from,to],i)=>({from,to,answer:answers[i]})));if(done)finish(true);}
  },
  first(series){
   if(current&&!page)page=series.map(task=>({from:task.from,to:task.to,source:task.source,answer:Number(task.answer),manip:task.usedManip,units:task.usedUnits}));
  },
  page(series){
   if(!current||!page)return;
   for(let i=0;i<series.length;i++)if(['corrected','badFinal'].includes(series[i].status)&&current.kind!=='lives'&&current.kind!=='sudden')page[i].correctedAnswer=Number(series[i].answer);
   if(current.kind==='lives'||current.kind==='sudden'){
    for(let i=0;i<series.length;i++){
     const good=Number(series[i].answer)===series[i].result;
     if(current.prefixSuccesses<10){current.tasks.push(page[i]);if(good)current.prefixSuccesses++;}
     else{current.tailSegments??=[0];if(good)current.tailSegments[current.tailSegments.length-1]++;else current.tailSegments.push(0);}
    }
   }else current.tasks.push(...page);
   page=null;
  },
  complete(){finish(true);},
  cancel(){if(current)current.sent=true;},
  abandon(){finish(false);},
 });
 document.getElementById('homeBtn').addEventListener('click',()=>finish(false));
 window.addEventListener('pagehide',()=>finish(false));
})();
