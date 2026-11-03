// One reversible switch for the five school Objectif record replacements.
// IMPORTANT: the new school launcher is not deployed yet; all three release
// conditions must be satisfied after authenticated TEST receipt/XP/projection.
// The LAB keeps using its isolated pilot until the final launcher is tested.
export const SCHOOL_RECORD_ROLLOUT=Object.freeze({
  enabled:false,
  atomicXpAndTrophiesVerified:false,
  hostedTestClassE2EVerified:false
});
export const SCHOOL_RECORD_LAUNCHER='./apps/objective-record/eleve.html';
export const SCHOOL_RECORD_APPS=Object.freeze({
  'addition-ecrite-simple':'addition-simple',
  'addition-ecrite-multiple':'addition-multiple',
  'soustraction-ecrite-simple':'soustraction',
  'multiplication-ecrite-simple':'multiplication',
  'melange-calculs-ecrits':'melange'
});
// Four curriculum spaces, five physical class presets after Phase 2 was split.
// TEST has a separate pilot and is deliberately not part of these identifiers.
export const SCHOOL_CLASS_IDS=Object.freeze([
  '8fe170fa-9e8f-4e80-885a-b0ba68026f64',
  '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',
  '1b021ed9-4846-4203-9c7b-4b5fa8d7adab',
  '0d8ba828-59cc-468b-a4b8-7b2a1af10b88',
  'a9195199-0a28-4e86-99ce-47b36dd6e646'
]);
const SCHOOL_CLASSES=new Set(SCHOOL_CLASS_IDS);
const APP_KEYS=new Set(Object.keys(SCHOOL_RECORD_APPS));
export function schoolRecordLaunch({classId,appKey,legacyUrl,rollout=SCHOOL_RECORD_ROLLOUT}){
  // No query string, student storage or client-supplied flag may activate this.
  // This is a navigation switch ONLY: server authentication remains mandatory.
  if(!APP_KEYS.has(appKey)||!SCHOOL_CLASSES.has(classId)
     ||rollout?.enabled!==true
     ||rollout?.atomicXpAndTrophiesVerified!==true
     ||rollout?.hostedTestClassE2EVerified!==true)return legacyUrl;
  return SCHOOL_RECORD_LAUNCHER+'?app='+encodeURIComponent(SCHOOL_RECORD_APPS[appKey]);
}

/**
 * Two certified additions can roll out independently of the other three.
 * This flag is deliberately CLOSED until school proof RPCs, hosted JWT,
 * professor results and projection have passed school-specific E2E tests.
 */
export const SCHOOL_ADDITIONS_ROLLOUT=Object.freeze({
  enabled:false,proofRpcsReady:false,hostedJwtVerified:false,projectionVerified:false
});
const ADDITION_KEYS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
export function schoolAdditionsLaunch({classId,appKey,legacyUrl,rollout=SCHOOL_ADDITIONS_ROLLOUT}){
  if(!SCHOOL_CLASSES.has(classId)||!ADDITION_KEYS.has(appKey)
    ||rollout.enabled!==true||rollout.proofRpcsReady!==true
    ||rollout.hostedJwtVerified!==true||rollout.projectionVerified!==true)return legacyUrl;
  return SCHOOL_RECORD_LAUNCHER+'?app='+encodeURIComponent(SCHOOL_RECORD_APPS[appKey]);
}
