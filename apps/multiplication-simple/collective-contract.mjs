// Contrat pur côté client : aucun XP ni récompense.
export const validPage=page=>Array.isArray(page)&&page.length===2&&page.every(x=>
 x&&typeof x.a==='string'&&/^[1-9][0-9]{1,6}$/.test(x.a)
 &&Number.isInteger(x.m)&&x.m>=2&&x.m<=9);
export const validSession=s=>s?.ok===true&&s?.active===true
 &&typeof s.sessionId==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s.sessionId)
 &&Number.isSafeInteger(s.revision)&&s.revision>=1&&[1,2,3].includes(s.level)
 &&['top','side'].includes(s.carryMethod)&&Array.isArray(s.pages)
 &&s.pages.length>=1&&s.pages.length<=120&&s.pages.every(validPage)
 &&s.pageIndex===s.pages.length-1&&typeof s.allowSkip==='boolean';
export const canAdvance=(finished,allowSkip,index,opened)=>index<opened&&(finished||allowSkip);
