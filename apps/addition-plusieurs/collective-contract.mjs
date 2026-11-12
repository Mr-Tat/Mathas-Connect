// Contrat pur du guidé collectif Addition multiple.
// Ne modifie ni le moteur natif, ni les scores, XP ou récompenses.
// Le format exact des opérations sera raccordé au générateur natif lors de l'adaptateur.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const positiveInteger=v=>typeof v==='string'&&/^[1-9][0-9]{0,6}$/.test(v);
export const validOperation=op=>Array.isArray(op?.terms)&&op.terms.length>=2&&op.terms.length<=8&&op.terms.every(positiveInteger);
export const validPage=page=>Array.isArray(page)&&page.length===2&&page.every(validOperation);
export const validSession=s=>s?.ok===true&&s.active===true
 &&typeof s.sessionId==='string'&&UUID.test(s.sessionId)
 &&Number.isSafeInteger(s.revision)&&s.revision>=1
 &&Array.isArray(s.pages)&&s.pages.length>=1&&s.pages.length<=120
 &&s.pages.every(validPage)
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
// Corrigé mathématique pur ; l'affichage des reports dépend du moteur natif.
export const resultOf=op=>validOperation(op)
 ?op.terms.reduce((sum,term)=>sum+BigInt(term),0n).toString():null;
