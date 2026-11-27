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
// The historic IDs above are retained for existing callers, not authorization.
const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
export function isSchoolClass(classId){return typeof classId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)&&classId.toLowerCase()!==TEST_CLASS;}
const APP_KEYS=new Set(Object.keys(SCHOOL_RECORD_APPS));
export function schoolRecordLaunch({classId,appKey,legacyUrl,rollout=SCHOOL_RECORD_ROLLOUT}){
  // No query string, student storage or client-supplied flag may activate this.
  // This is a navigation switch ONLY: server authentication remains mandatory.
  if(!APP_KEYS.has(appKey)||!isSchoolClass(classId)
     ||rollout?.enabled!==true
     ||rollout?.atomicXpAndTrophiesVerified!==true
     ||rollout?.hostedTestClassE2EVerified!==true)return legacyUrl;
  return SCHOOL_RECORD_LAUNCHER+'?app='+encodeURIComponent(SCHOOL_RECORD_APPS[appKey]);
}

/**
 * Two certified additions can roll out independently of the other three.
 * Activate ONLY after documented hosted professor JWT, receipts, trophies,
 * projection and the server native-score bypass guard all pass review.
 * This PR is an activation candidate and must remain DRAFT until that moment.
 */
export const SCHOOL_ADDITIONS_ROLLOUT=Object.freeze({
  enabled:true,proofRpcsReady:true,hostedJwtVerified:true,projectionVerified:true
});
const ADDITION_KEYS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
export function schoolAdditionsLaunch({classId,appKey,legacyUrl,rollout=SCHOOL_ADDITIONS_ROLLOUT,freeMode=false}){
  // The HUB's explicitly selected free mode must never open the certified
  // school launcher: that launcher needs the remote Supabase SDK even for a guest.
  if(freeMode===true)return legacyUrl;
  if(!isSchoolClass(classId)||!ADDITION_KEYS.has(appKey)
    ||rollout.enabled!==true||rollout.proofRpcsReady!==true
    ||rollout.hostedJwtVerified!==true||rollout.projectionVerified!==true)return legacyUrl;
  return SCHOOL_RECORD_LAUNCHER+'?app='+encodeURIComponent(SCHOOL_RECORD_APPS[appKey]);
}
