// Générateurs de pages du guidé collectif, sans aucune réponse d'élève.
// Formats dictés par les trois moteurs natifs ; les pages sont persistées par l'Edge.
export const WRITTEN_GUIDED_APPS=Object.freeze([
 'addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple'
]);
export const maxDigitsForLevel=(level,appKey='addition-ecrite-multiple')=>
 (appKey==='addition-ecrite-multiple'?[5,6,7]:[3,5,7])[level-1]??null;
export const addendCountForLevel=level=>[3,4,5][level-1]??null;
export const minimumDigitsForLevel=level=>[3,3,4][level-1]??null;
export function unbiasedRand(max){
 if(!Number.isSafeInteger(max)||max<1||max>0x100000000)throw Error('invalid_random_range');
 const upper=0x100000000-(0x100000000%max);let n;
 do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=upper);
 return n%max;
}
function numberDigits(len,rand){
 let v=String(1+rand(9));
 while(v.length<len)v+=String(rand(10));
 return v;
}
function additionCarries(terms){
 const count=Math.max(...terms.map(x=>x.length));
 const incoming=Array(count).fill(0),outgoing=Array(count).fill(0);let carry=0;
 for(let c=0;c<count;c++){
  incoming[c]=carry;
  let sum=carry;
  for(const n of terms)sum+=Number(n[n.length-1-c]||0);
  carry=Math.floor(sum/10);outgoing[c]=carry;
 }
 return {incoming,outgoing,hasCarry:outgoing.some(v=>v>0)};
}
function borrowPattern(top,bottom){
 const count=top.length,need=Array(count).fill(false);let carry=0;
 for(let c=0;c<count;c++){
  const a=Number(top[top.length-1-c]||0),b=Number(bottom[bottom.length-1-c]||0);
  if(a<b+carry){
   if(c===count-1)return null;
   need[c]=true;carry=1;
  }else carry=0;
 }
 return need;
}
function simpleAddition(level,rand){
 const digits=maxDigitsForLevel(level,'addition-ecrite-simple'),wantCarry=rand(100)<80;
 for(let tries=0;tries<1600;tries++){
  const a=numberDigits(digits,rand),b=numberDigits(digits-(rand(100)<15?1:0),rand);
  if(additionCarries([a,b]).hasCarry===wantCarry||tries===1599)return {a,b};
 }
}
function multipleAddition(level,rand){
 const digits=maxDigitsForLevel(level),minimum=minimumDigitsForLevel(level);
 const count=addendCountForLevel(level),wantCarry=rand(100)<80;
 const maxCount=Math.floor(count/2)+1;
 for(let tries=0;tries<1800;tries++){
  const lengths=Array(maxCount).fill(digits);
  while(lengths.length<count)lengths.push(digits-1-rand(digits-minimum));
  for(let i=lengths.length-1;i>0;i--){const j=rand(i+1);[lengths[i],lengths[j]]=[lengths[j],lengths[i]]}
  const addends=lengths.map(len=>numberDigits(len,rand));
  if(additionCarries(addends).hasCarry===wantCarry||tries===1799)return {addends};
 }
}
function subtraction(level,rand){
 const digits=maxDigitsForLevel(level,'soustraction-ecrite-simple'),wantBorrow=rand(100)<80;
 for(let tries=0;tries<50000;tries++){
  const a=numberDigits(digits,rand),b=numberDigits(digits-(rand(100)<15?1:0),rand);
  if(BigInt(a)<=BigInt(b))continue;
  const pattern=borrowPattern(a,b);if(!pattern)continue;
  if(pattern.some(Boolean)===wantBorrow||tries===49999)return {a,b};
 }
 throw Error('subtraction_generation_failed');
}
export function generateOperation(appKey,level,rand=unbiasedRand){
 if(!WRITTEN_GUIDED_APPS.includes(appKey)||!maxDigitsForLevel(level)||typeof rand!=='function')
  throw Error('invalid_guided_generator');
 switch(appKey){
  case 'addition-ecrite-simple':return simpleAddition(level,rand);
  case 'addition-ecrite-multiple':return multipleAddition(level,rand);
  case 'soustraction-ecrite-simple':return subtraction(level,rand);
 }
}
export function generatePage(appKey,level,rand=unbiasedRand){
 return [generateOperation(appKey,level,rand),generateOperation(appKey,level,rand)];
}
export {additionCarries,borrowPattern};
