// Deliberately local and fictitious. Never constructs a Supabase client.
import {createPilot} from './connect-pilot.mjs';
import {applyCompletion,empty} from './records.mjs';
import {milestones} from './xp-model.mjs';
export function createLocalLab({storage,onStatus}){
 const key='mathas.calculs-melanges.lab.simulation.v1';
 let saved;try{saved=JSON.parse(storage.getItem(key))}catch{}
 let state=saved?.state??empty(),revision=saved?.revision??0,ids=saved?.ids??[];
 const pilot=createPilot({storage,classId:'00000000-0000-4000-8000-000000000001',studentId:'00000000-0000-4000-8000-000000000002',onStatus,
  post:async event=>{
   const correlation={eventId:event.eventId,appKey:event.appKey,storageSubject:event.expectedStudentId};
   const before=milestones(state).xp;
   if(ids.includes(event.eventId))return {...correlation,ok:true,duplicate:true,revision,resetEpoch:0,xp:{appXp:before,total:before,delta:0}};
   if(event.expectedRevision!==revision||event.expectedResetEpoch!==0)return {ok:false,status:409};
   state=applyCompletion(state,event);revision++;ids=[...ids,event.eventId];
   storage.setItem(key,JSON.stringify({state,revision,ids}));
   const xp=milestones(state).xp;
   return {...correlation,ok:true,revision,resetEpoch:0,state,xp:{appXp:xp,total:xp,delta:xp-before}};
  }});
 pilot.initialize(revision,0);return pilot;
}
