// Chargé en PREMIER dans la COPIE srcdoc : moteur original inchangé.
// Chaque contexte libre / laboratoire / élève possède ses propres résultats.
// N'intercepte que les clés natives de cette application, jamais l'auth du HUB.
(function(){
 'use strict';
 const frame=window.frameElement;
 const scope=frame&&frame.getAttribute('data-mathas-storage-scope');
 if(!scope||!/^([a-z0-9-]{1,50})(\.[a-z0-9-]{1,50}){0,2}$/.test(scope))
   throw Error('invalid_mathas_storage_scope');
 const ns='mathas.addition-plusieurs.game.'+scope+'.v1:';
 const p=Storage.prototype;
 const get=p.getItem,set=p.setItem,remove=p.removeItem;
 const scoped=(key)=>{const str=String(key);return /^(addition2_|mathas_)/.test(str)?ns+str:str};
 p.getItem=function(key){return get.call(this,this===localStorage?scoped(key):key)};
 p.setItem=function(key,value){return set.call(this,this===localStorage?scoped(key):key,value)};
 p.removeItem=function(key){return remove.call(this,this===localStorage?scoped(key):key)};
 Object.defineProperty(window,'__mathasGameStorageScope',{value:scope,configurable:false});
})();
