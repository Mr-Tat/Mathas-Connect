// File durable sans polling : ne supprime jamais un événement non acquitté.
// Storage injecté pour tests et séparation libre/Connect.
export function createQueue(storage,key){
 if(!/^mathas\.calculs-melanges\.connect\./.test(key))throw Error('namespace_required');
 const read=()=>{try{const x=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(x)?x.filter(e=>e&&typeof e.eventId==='string').slice(0,100):[]}catch{return []}};
 const write=list=>storage.setItem(key,JSON.stringify(list));
 return Object.freeze({
  read,
  enqueue(event){if(!event||typeof event.eventId!=='string')throw Error('event_id_required');const list=read();if(list.some(e=>e.eventId===event.eventId))return false;if(list.length>=100)throw Error('queue_full');list.push(event);write(list);return true;},
  acknowledge(eventId){const list=read(),next=list.filter(e=>e.eventId!==eventId);if(next.length===list.length)return false;write(next);return true;},
  quarantineEpoch(epoch){
   if(!Number.isSafeInteger(epoch)||epoch<0)throw Error('invalid_epoch');
   const list=read(),stale=list.filter(e=>e.expectedResetEpoch!==epoch);
   if(!stale.length)return 0;
   // Preserve older parcours results under the SAME pupil-specific namespace.
   // A storage quota failure must never discard an unsent event.
   const archiveKey=key+'.previous-parcours.v1';
   let archived;
   try{archived=JSON.parse(storage.getItem(archiveKey)||'[]')}catch{archived=[]}
   if(!Array.isArray(archived))archived=[];
   const known=new Set(archived.map(e=>e?.eventId));
   for(const event of stale)if(!known.has(event.eventId)){archived.push(event);known.add(event.eventId)}
   if(archived.length>100)throw Error('quarantine_archive_full');
   storage.setItem(archiveKey,JSON.stringify(archived));
   write(list.filter(e=>e.expectedResetEpoch===epoch));
   return stale.length;
  },
  archivedCount(){
   try{const items=JSON.parse(storage.getItem(key+'.previous-parcours.v1')||'[]');return Array.isArray(items)?items.length:0}catch{return 0}
  },
  count(){return read().length}
 });
}
