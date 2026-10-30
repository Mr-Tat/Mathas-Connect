import {normalizeCompletion} from './completion-contract.mjs';
import {createQueue} from './offline-queue.mjs';
import {createSync} from './sync-protocol.mjs';
// Banc d'essai injecté: aucun secret, aucune requête Supabase, aucun accès à la production.
export function createSimulatedSession({storage,post,uuid,onStatus=()=>{},initialRevision=0,initialEpoch=0}){
 const queue=createQueue(storage,'mathas.addition-plusieurs.connect.simulation.v1');
 let revision=initialRevision,epoch=initialEpoch;
 const sync=createSync({queue,post,getState:()=>({revision,resetEpoch:epoch}),onAck:(_event,response)=>{revision=response.revision;epoch=response.resetEpoch;onStatus('saved',response)},onConflict:r=>onStatus('conflict',r),onError:e=>onStatus('offline',e)});
 return {
  completed(raw){
   const event=normalizeCompletion(raw);if(!event)return false;
   queue.enqueue({...event,action:'game-record',eventId:uuid(),expectedRevision:revision,expectedResetEpoch:epoch,points:0});
   onStatus('queued');return true;
  },
  flush:()=>sync.flush(),
  pending:()=>queue.count(),
  get revision(){return revision}
 };
}
