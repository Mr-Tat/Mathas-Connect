// Validation préalable, NON suffisante comme preuve d'une vraie partie.
// La fonction Edge doit en outre contrôler JWT, classe, révision et reset_epoch.
export const APP_KEY='addition-ecrite-multiple';
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
export function validateRecord(input){
 if(!input||input.appKey!==APP_KEY||input.action!=='game-record')return null;
 if(!integer(input.level,1,3)||!integer(input.score,0,100000))return null;
 if(typeof input.eventId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.eventId))return null;
 if(!integer(input.expectedRevision,0,1e9)||!integer(input.expectedResetEpoch,0,1e9))return null;
 const {mode,score,total}=input;
 if(mode==='classic'&&![4,10,20].includes(total))return null;
 if(mode==='hard-challenge'&&total!==5)return null;
 if((mode==='sudden'||mode==='hard')&&total!=null)return null;
 if(!['classic','sudden','hard','hard-challenge'].includes(mode))return null;
 if(total!=null&&score>total)return null;
 // Pas de confiance dans des points arbitraires venus du client.
 if(input.points!==0)return null;
 return {appKey:APP_KEY,mode,level:input.level,score,total:total??null,eventId:input.eventId,expectedRevision:input.expectedRevision,expectedResetEpoch:input.expectedResetEpoch,points:0};
}
