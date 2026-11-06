import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCertifiedHistoricalPodium} from '../apps/objective-record/school-score-view.mjs';

const makeDoc=()=>{
 const labels=Array.from({length:3},()=>({
  textContent:'—',
  classList:{remove(){}},
  append(child){this.textContent+=child.textContent}
 }));
 return {
  labels,
  querySelector(selector){
   return selector==='#mathasPointsDetail [data-points="allThree"]'
    ?{querySelectorAll:()=>labels.map(label=>({querySelector:()=>label}))}:null;
  },
  createElement(){return {textContent:''}}
 };
};
const events=[
 {eventId:'11111111-1111-4111-8111-111111111111',score:10,points:130,at:'2026-11-03T10:00:00Z'},
 {eventId:'22222222-2222-4222-8222-222222222222',score:15,points:500,at:'2026-11-05T10:00:00Z'}
];
test('podium historique Connect : trois places, tri serveur et stabilité',()=>{
 const doc=makeDoc();
 assert.equal(renderCertifiedHistoricalPodium(doc,{ok:true,bestThree:events}),true);
 assert.deepEqual(doc.labels.map(x=>x.textContent),['500 pts','130 pts','—']);
 assert.equal(renderCertifiedHistoricalPodium(doc,{ok:true,bestThree:events}),true);
 assert.deepEqual(doc.labels.map(x=>x.textContent),['500 pts','130 pts','—']);
});
test('réponse non certifiée ignorée : aucun faux record affiché',()=>{
 const doc=makeDoc();
 assert.equal(renderCertifiedHistoricalPodium(doc,{ok:false,bestThree:events}),false);
 assert.deepEqual(doc.labels.map(x=>x.textContent),['—','—','—']);
});
test('réponse officielle sans historique : podium vide et sans erreur',()=>{
 const doc=makeDoc();
 assert.equal(renderCertifiedHistoricalPodium(doc,{ok:true,bestThree:[]}),true);
 assert.deepEqual(doc.labels.map(x=>x.textContent),['—','—','—']);
});
