// Shared deterministic sequence; a single server seed authorizes a complete run,
// including arbitrarily many challenge cycles, with no per-question network call.
export function questionSequence(activity,seed){
 if(!/^[0-9a-f-]{36}$/i.test(seed))throw Error('invalid_seed');
 let state=2166136261;for(const ch of seed){state^=ch.charCodeAt(0);state=Math.imul(state,16777619)>>>0}if(!state)state=1;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const all=Array.from({length:100},(_,i)=>(i+1)*2);
 const even=all.filter(n=>n%20===0),odd=all.filter(n=>n%20===10),whole=all.filter(n=>n%10===0),dec=all.filter(n=>n%10!==0);
 const pools={even,odd,mix:whole,gi1:whole,gi2:whole,decimal1:dec,decimal2:dec,decimal3:dec,g1:dec.filter(n=>n>=20),g2:dec.filter(n=>n>=20),g3:dec.filter(n=>n>=20)};
 if(!Object.hasOwn(pools,activity))throw Error('invalid_activity');
 let queue=[];
 return ()=>{if(!queue.length)queue=activity==='mix'?shuffle([...shuffle([...even]).slice(0,5),...shuffle([...odd]).slice(0,5)]):shuffle([...pools[activity]]);return queue.shift()};
}
export function verifySequence(proof,seed){
 const next=questionSequence(proof.activity,seed);
 if(!proof.items.every(item=>item.n===next()))throw Error('invalid_sequence');
}
