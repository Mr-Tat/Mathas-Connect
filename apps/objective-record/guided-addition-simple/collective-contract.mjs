// Règles pures du guidé collectif Addition simple.
// Aucun effet sur les réponses natives, scores, XP ou trophées.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=v=>typeof v==='string'&&/^[1-9][0-9]{0,6}$/.test(v);
export const validOperation=o=>integer(o?.a)&&integer(o?.b);
export const validPage=p=>Array.isArray(p)&&p.length===2&&p.every(validOperation);
export const validSession=s=>s?.ok===true&&s.active===true
 &&UUID.test(s.sessionId||'')&&Number.isSafeInteger(s.revision)&&s.revision>=1
 &&Array.isArray(s.pages)&&s.pages.length>=1&&s.pages.length<=120&&s.pages.every(validPage)
 &&Number.isInteger(s.pageIndex)&&s.pageIndex>=0&&s.pageIndex<s.pages.length
 &&Array.isArray(s.requiredPages)&&s.requiredPages.length===s.pages.length
 &&s.requiredPages.every(x=>typeof x==='boolean');
export function mayMoveForward({session,from,to,isFinished}){
 if(!validSession(session)||!Number.isInteger(from)||!Number.isInteger(to)
  ||from<0||to<=from||to>=session.pages.length||typeof isFinished!=='function')return false;
 for(let i=0;i<to;i++)if(session.requiredPages[i]&&!isFinished(i))return false;
 return true;
}
export function entryPage(session,isFinished){
 if(!validSession(session)||typeof isFinished!=='function')return -1;
 for(let i=0;i<session.pageIndex;i++)
  if(session.requiredPages[i]&&!isFinished(i))return i;
 return session.pageIndex;
}
export const resultOf=o=>validOperation(o)?(BigInt(o.a)+BigInt(o.b)).toString():null;
// Retenues entrantes pour le corrigé, rangées par colonne depuis les unités.
// Purement mathématique : le pont natif devra placer les chiffres sous les cases.
export function incomingCarries(o){
 if(!validOperation(o))return null;
 const a=o.a.split('').reverse(),b=o.b.split('').reverse(),n=Math.max(a.length,b.length);
 const incoming=Array(n).fill(0);let carry=0;
 for(let col=0;col<n;col++){
  incoming[col]=carry;
  carry=Math.floor((Number(a[col]||0)+Number(b[col]||0)+carry)/10);
 }
 return incoming;
}

export const latestUnlockedPage=session=>Array.isArray(session?.pages)?session.pages.length-1:-1;
