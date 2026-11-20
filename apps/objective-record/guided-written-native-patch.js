// Pont natif du guidé collectif dans les moteurs Objectif record scolaires.
// Aucun changement de barème, d'XP ni d'état de score. En cas de dérive de moteur,
// désactiver CE pont seulement et préserver les autres modes.
(function(){
 'use strict';
 const sources=Object.freeze({
  'addition-ecrite-simple':'/CE-Addition-simple/collective-native-bridge.js?v=20261117-guided-reprise-v2',
  'addition-ecrite-multiple':'/Mathas-Connect/apps/addition-plusieurs/collective-native-bridge.js?v=20261117-guided-reprise-v2'
 });
 const marker="primaryBtn.addEventListener('click',handlePrimary);";
 window.MathasWrittenGuidedNativePatch=async function(game,appKey){
  const path=sources[appKey];
  if(!path||typeof game!=='string')return game;
  try{
   if(game.split(marker).length!==2)throw Error('Accroche native différente');
   const response=await fetch(path);
   if(!response.ok)throw Error('Pont natif absent');
   const source=await response.text();
   if(!source.includes('window.MathasGuidedBridge')||!source.includes('isCollectiveActive'))throw Error('Pont natif invalide');
   const hook=source+'\nconst mathasGuidedOriginalPrimary=handlePrimary;'
    +'\nhandlePrimary=function(...args){if(window.MathasGuidedBridge?.isCollectiveActive()&&phase==="review"){window.MathasGuidedBridge.onContinue?.();return;}return mathasGuidedOriginalPrimary(...args)};'
    +'\nprimaryBtn.addEventListener("click",handlePrimary);';
   return game.replace(marker,hook);
  }catch(error){
   console.warn('Guidé collectif non injecté ; autres modes conservés.',error);
   return game;
  }
 };
})();
