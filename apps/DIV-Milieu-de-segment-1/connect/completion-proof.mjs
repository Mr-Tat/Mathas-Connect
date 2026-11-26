// Native completion evidence, independent of XP, scores, trophies and identity.
// This validator checks mathematics and the completed sequence. It is NOT authentication:
// the caller must additionally bind the event to a server-authorized student/class/run/epoch.
export const PROOF_VERSION=1;
const config=Object.freeze({even:[10,"even",["calc"]],odd:[10,"odd",["calc"]],mix:[10,"integer",["calc"]],gi1:[6,"integer",["calc","place"]],gi2:[6,"integer",["measure","calc","place"]],decimal:[10,"decimal",["calc"]],g1:[5,"decimalGeo",["calc","place"]],g2:[10,"decimalGeo",["calc","place"]],g3:[10,"decimalGeo",["measure","calc","place"]]});
const fail=()=>{throw Error("invalid_completion")};
const integer=v=>Number.isSafeInteger(v);
const range=(v,min,max)=>integer(v)&&v>=min&&v<=max;
const domain=(n,kind)=>range(n,1,200)&&n%2===0&&(
 kind==="even"?n%20===0:kind==="odd"?n%20===10:kind==="integer"?n%10===0:
 kind==="decimalGeo"?n>=20&&n%10!==0:n%10!==0);
const keys=(obj,allowed)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).every(k=>allowed.includes(k));
export function judgeNativeCompletion(p){
 if(!keys(p,["version","activity","mode","items"])||p.version!==PROOF_VERSION||typeof p.activity!=="string"||!Object.hasOwn(config,p.activity)||!Array.isArray(p.items))fail();
 const [count,kind,steps]=config[p.activity],challenge=p.mode!==null;
 if(challenge&&(!["sudden","lives"].includes(p.mode)||!["gi2","g3"].includes(p.activity)))fail();
 if(!challenge&&p.items.length!==count||challenge&&!p.items.length)fail();
 const limit=p.mode==="sudden"?1:3;
 let firstGood=0,errors=0,assistedItems=0,helpActivations=0;const used=new Set(),items=[];
 const cycleSize=kind==="integer"?20:72; // decimal geo: even mm >= 20, excluding integer cm
 for(const item of p.items){
  if(challenge&&errors>=limit)fail();
  if(!keys(item,["n","helps","attempts"])||!domain(item.n,kind)||!Array.isArray(item.helps)||!Array.isArray(item.attempts)||!item.attempts.length)fail();
  if(challenge&&used.size===cycleSize)used.clear();
  if(used.has(item.n))fail();used.add(item.n);
  const h=item.helps;if(new Set(h).size!==h.length||h.some(x=>!["manip","decomp"].includes(x))||
   h.length&&(challenge||p.activity==="even")||h.includes("decomp")&&item.n%10===0||
   item.n%10!==0&&h.includes("manip")&&!h.includes("decomp"))fail();
  assistedItems+=Number(h.length>0);helpActivations+=h.length;
  let stage=0,first=true,failed=false;
  for(const a of item.attempts){
   if(failed||stage===steps.length||!keys(a,["stage","value","tick"])||a.stage!==steps[stage])fail();
   let correct;
   if(a.stage==="calc"){if(!range(a.value,0,Number.MAX_SAFE_INTEGER)||Object.hasOwn(a,"tick"))fail();correct=a.value===item.n/2}
   else if(a.stage==="measure"){if(!range(a.value,0,Number.MAX_SAFE_INTEGER)||!range(a.tick,0,200))fail();correct=a.value===item.n&&a.tick===item.n}
   else{if(!range(a.tick,0,200)||Object.hasOwn(a,"value"))fail();correct=a.tick===item.n/2}
   if(correct)stage++;else{first=false;if(challenge)failed=true}
  }
  if(!failed&&stage!==steps.length)fail();
  if(first)firstGood++;else errors++;
  items.push({n:item.n,firstGood:first,helps:[...h]});
 }
 if(challenge&&errors!==limit)fail();
 if(p.activity==="mix"&&p.items.filter(x=>x.n%20===0).length!==5)fail();
 return {activity:p.activity,mode:p.mode,total:p.items.length,firstGood,errors,assistedItems,helpActivations,clean:assistedItems===0,items};
}
