// Addition multiple V6.0.2: normalisation stricte avant proposition au serveur.
// Ce module ne crédite aucun XP et n'effectue aucun appel réseau.
export const APP_KEY='addition-ecrite-multiple';
export const MODES=Object.freeze(['classic','sudden','hard-challenge','hard']);
export function normalizeCompletion(entry){
 if(!entry||typeof entry.label!=='string'||typeof entry.score!=='string')return null;
 const label=entry.label.trim(),scoreText=entry.score.trim();
 let mode,level,total=null,score;
 let match=label.match(/^Calculs · Niveau ([1-3])$/);
 if(match){mode='classic';level=Number(match[1]);const parsed=scoreText.match(/^(\d+)\/(4|10|20)$/);if(!parsed)return null;score=Number(parsed[1]);total=Number(parsed[2]);}
 else if((match=label.match(/^Mort subite · Niveau ([1-3])$/))){mode='sudden';level=Number(match[1]);if(!/^\d+$/.test(scoreText))return null;score=Number(scoreText);}
 else if((match=label.match(/^HARD NIV ([1-3]) · 5 calculs$/))){mode='hard-challenge';level=Number(match[1]);const parsed=scoreText.match(/^(\d+)\/5$/);if(!parsed)return null;score=Number(parsed[1]);total=5;}
 else if((match=label.match(/^HARD NIV ([1-3]) · Mort subite · \d+ chiffres$/))){mode='hard';level=Number(match[1]);if(!/^\d+$/.test(scoreText))return null;score=Number(scoreText);}
 else return null;
 if(!Number.isSafeInteger(score)||score<0||score>100000||(total!==null&&score>total))return null;
 return Object.freeze({appKey:APP_KEY,mode,level,score,total,rulerUsed:entry.rulerUsed===true});
}
