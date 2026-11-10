// Contrat pur côté client : aucune réponse, récompense ni score vers le serveur.
export const validPage=page=>Array.isArray(page)&&page.length===2&&page.every(x=>
 x&&typeof x.a==='string'&&/^[1-9][0-9]{1,6}$/.test(x.a)
 &&Number.isInteger(x.m)&&x.m>=2&&x.m<=9);
export const validSession=s=>s?.ok===true&&s?.active===true
 &&typeof s.sessionId==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.sessionId)
 &&Number.isSafeInteger(s.revision)&&s.revision>=1&&[1,2,3].includes(s.level)
 &&['top','side'].includes(s.carryMethod)&&Array.isArray(s.pages)
 &&s.pages.length>=1&&s.pages.length<=120&&s.pages.every(validPage)
 &&Number.isInteger(s.pageIndex)&&s.pageIndex===s.pages.length-1
 &&Number.isInteger(s.teacherPageIndex??s.pageIndex)
 &&(s.teacherPageIndex??s.pageIndex)>=0&&(s.teacherPageIndex??s.pageIndex)<=s.pageIndex
 &&Array.isArray(s.requiredPages??[])
 &&(s.requiredPages??[]).every(n=>Number.isInteger(n)&&n>=0&&n<=s.pageIndex)
 &&typeof s.allowSkip==='boolean';
// Conserver cet alias pour les autres tests historiques.
export const canAdvance=(finished,allowSkip,index,opened)=>index<opened&&(finished||allowSkip);
export const canReachPage=({current,target,unlocked,requiredPages=[],isFinished=()=>false})=>{
 if(!Number.isInteger(current)||!Number.isInteger(target)||!Number.isInteger(unlocked)
  ||target<0||target>unlocked)return false;
 if(target<=current)return true;
 // Le professeur a ouvert toutes ces pages, mais les étapes obligatoires
 // du trajet doivent être réussies (y compris une page antérieure à current).
 return !requiredPages.some(i=>i<target&&!isFinished(i));
};
export const mandatoryBlocker=({target,requiredPages=[],isFinished=()=>false})=>
 requiredPages.filter(i=>i<target&&!isFinished(i)).sort((a,b)=>a-b)[0]??null;
