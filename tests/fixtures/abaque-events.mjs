import {randomUUID} from 'node:crypto';
export const pilotClass='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const base=kind=>({version:1,eventId:randomUUID(),expectedResetEpoch:0,kind,completed:true,master:false});
export function build(correct=12){
 const event={...base('build'),units:['km','m','cm','mm'].map(unit=>({unit,placed:unit})),images:[['ant','mm'],['coin','mm'],['phone','cm'],['shoe','cm'],['car','m'],['door','m'],['verviers-liege','km'],['verviers-spa','km']].map(([image,placed])=>({image,placed}))};
 for(let wrong=0;wrong<12-correct;wrong++){if(wrong<4)event.units[wrong].placed='hm';else event.images[wrong-4].placed=event.images[wrong-4].placed==='km'?'m':'km';}
 return event;
}
export function moves(correct=8){
 const units=['km','hm','dam','m','dm','cm','mm'];
 const pairs=[['km','m'],['m','cm'],['cm','mm'],['m','km'],['mm','m'],['cm','km'],['mm','cm'],['m','mm']];
 return {...base('moves'),tasks:pairs.map(([from,to],i)=>({from,to,answer:i<correct?units.indexOf(to)-units.indexOf(from):0}))};
}
export function classic(kind='one',correct={one:4,three:12,five:20}[kind]){
 const pairs=[['km','m',2000],['m','cm',200],['cm','mm',20],['m','mm',2000]];
 return {...base(kind),tasks:Array.from({length:{one:4,three:12,five:20}[kind]},(_,i)=>{
  const [from,to,result]=pairs[i%4];return {from,to,source:2,answer:i<correct?result:0,manip:false,units:false};
 })};
}
export function record(kind='sudden',successes=10,{abandoned=false}={}){
 return {...base(kind),completed:!abandoned,...(abandoned?{abandoned:true}:{}),tasks:Array.from({length:successes+(abandoned?0:kind==='lives'?3:1)},(_,i)=>({from:'m',to:'cm',source:2,answer:i<successes?200:0,manip:false,units:false}))};
}
