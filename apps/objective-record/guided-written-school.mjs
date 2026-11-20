// Raccorde l'hôte Objectif record scolaire aux contrôleurs collectifs existants.
// Les calculs guidés sont non notés, sans réponse élève envoyée au serveur.
const CONTROLLERS=Object.freeze({
 'addition-ecrite-simple':async()=>({module:await import('/CE-Addition-simple/collective-ui.mjs?v=20261117-guided-reprise-v2'),name:'createAdditionSimpleCollective'}),
 'addition-ecrite-multiple':async()=>({module:await import('../addition-plusieurs/collective-ui.mjs?v=20261117-guided-reprise-v2'),name:'createAdditionMultipleCollective'})
});
const LABELS=Object.freeze({
 '8fe170fa-9e8f-4e80-885a-b0ba68026f64':'Observation',
 '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e':'Phase 1',
 '1b021ed9-4846-4203-9c7b-4b5fa8d7adab':'Phase 2 A',
 '0d8ba828-59cc-468b-a4b8-7b2a1af10b88':'Phase 2 B',
 'a9195199-0a28-4e86-99ce-47b36dd6e646':'2 ECO',
 '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9':'TEST'
});
export async function mountWrittenGuidedClass({iframe,appKey,teacher,classId,studentId='',storage=null,call,onClose,isCurrent=()=>true}){
 const loader=CONTROLLERS[appKey];
 if(!loader||typeof call!=='function'||!iframe?.contentDocument||!isCurrent())return null;
 // Si le moteur change, échouer sans masquer le jeu individuel ni les scores.
 if(typeof iframe.contentWindow?.MathasGuidedBridge?.status!=='function')throw Error('Pont natif guidé non installé');
 const {module,name}=await loader();
 if(!isCurrent())return null;
 if(typeof module[name]!=='function')throw Error('Contrôleur guidé non disponible');
 const controller=module[name]({
  iframe,teacher,classId,classLabel:LABELS[classId]||'Classe',
  studentId:teacher?'':studentId,storage,call,onClose
 });
 controller.mount();
 return controller;
}
