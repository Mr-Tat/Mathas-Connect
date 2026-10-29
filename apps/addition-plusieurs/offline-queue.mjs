// File durable sans polling : ne supprime jamais un événement non acquitté.
// Storage injecté pour tests et séparation libre/Connect.
export function createQueue(storage,key){
 if(!/^mathas\.addition-plusieurs\.connect\./.test(key))throw Error('namespace_required');
 const read=()=>{try{const x=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(x)?x.filter(e=>e&&typeof e.eventId==='string').slice(0,100):[]}catch{return []}};
 const write=list=>storage.setItem(key,JSON.stringify(list));
 return Object.freeze({
  read,
  enqueue(event){if(!event||typeof event.eventId!=='string')throw Error('event_id_required');const list=read();if(list.some(e=>e.eventId===event.eventId))return false;if(list.length>=100)throw Error('queue_full');list.push(event);write(list);return true;},
  acknowledge(eventId){const list=read(),next=list.filter(e=>e.eventId!==eventId);if(next.length===list.length)return false;write(next);return true;},
  count(){return read().length}
 });
}
