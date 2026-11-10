// Règles de progression des élèves : aucune récompense ni donnée enregistrée.
export const validPage=page=>Array.isArray(page)&&page.length===2&&page.every(x=>
 x&&typeof x.a==='string'&&/^[1-9][0-9]{1,6}$/.test(x.a)
 &&Number.isInteger(x.m)&&x.m>=2&&x.m<=9);

export const validSession=s=>s?.ok===true&&s?.active===true
 &&typeof s.sessionId==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.sessionId)
 &&Number.isSafeInteger(s.revision)&&s.revision>=1&&[1,2,3].includes(s.level)
 &&['top','side'].includes(s.carryMethod)&&Array.isArray(s.pages)
 &&s.pages.length>=1&&s.pages.length<=120&&s.pages.every(validPage)
 &&Number.isInteger(s.pageIndex)&&s.pageIndex>=0&&s.pageIndex<s.pages.length
 &&Array.isArray(s.requiredPages)&&s.requiredPages.length===s.pages.length
 &&s.requiredPages.every(v=>typeof v==='boolean');

export const latestUnlockedPage=session=>Array.isArray(session?.pages)?session.pages.length-1:-1;

// Une page ordinaire se quitte librement vers l'avant, mais une page rendue
// obligatoire par le professeur doit avoir ses deux opérations justes.
// On ne peut jamais sauter une obligation entre le départ et la destination.
// isFinished(index) est le résultat LOCAL de l'élève, jamais transmis au serveur.
export function mayMoveForward({session,from,to,isFinished}){
 if(!validSession(session)||!Number.isInteger(from)||!Number.isInteger(to)
  ||from<0||to<=from||to>=session.pages.length||typeof isFinished!=='function')return false;
 for(let page=from;page<to;page++)
  if(session.requiredPages[page]&&!isFinished(page))return false;
 return true;
}
export const canAdvance=(finished,required,index,opened)=>index<opened&&(!required||finished);
