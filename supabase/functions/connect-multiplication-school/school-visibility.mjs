// School rollout permission for the certified multiplication engine.
// Exact mapping of the five existing class IDs to GLOBAL school presets.
// Neither a direct URL nor the generic connect_apps.enabled flag opens a class.
export const MULTIPLICATION_TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
export const MULTIPLICATION_SCHOOL_PRESETS=Object.freeze({
 '8fe170fa-9e8f-4e80-885a-b0ba68026f64':'observation',
 '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e':'phase1',
 '1b021ed9-4846-4203-9c7b-4b5fa8d7adab':'phase2',
 '0d8ba828-59cc-468b-a4b8-7b2a1af10b88':'phase2b',
 'a9195199-0a28-4e86-99ce-47b36dd6e646':'2eco'
});
export function multiplicationSchoolPreset(classId){{
 return Object.hasOwn(MULTIPLICATION_SCHOOL_PRESETS,classId)
  ? MULTIPLICATION_SCHOOL_PRESETS[classId]:null;
}
export function mayStartMultiplicationSchoolProof(classId,visible){{
 return classId===MULTIPLICATION_TEST_CLASS
  ||(multiplicationSchoolPreset(classId)!==null&&visible===true);
}
