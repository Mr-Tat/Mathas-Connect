// État du HUB : identifiant de classe public, jamais un droit d'accès.
const KEY='mathas.connect.active-class.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const params=new URLSearchParams(location.search);
const spaces={observation:['8fe170fa-9e8f-4e80-885a-b0ba68026f64','Observation'],phase1:['71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e','Phase 1'],phase2:['1b021ed9-4846-4203-9c7b-4b5fa8d7adab','Phase 2 A'],phase2b:['0d8ba828-59cc-468b-a4b8-7b2a1af10b88','Phase 2 B'],'2eco':['a9195199-0a28-4e86-99ce-47b36dd6e646','2 ECO']};
const space=spaces[params.get('space')||''];
export const classId=UUID.test(params.get('class')||'')?params.get('class'):(space?.[0]||null);
export const classLabel=(params.get('name')||'').trim().slice(0,80)||space?.[1]||'Ma classe';
export function hubUrl(id=classId,name=classLabel){
 const u=new URL('./hub.html',location.href);
 if(id&&UUID.test(id)){u.searchParams.set('class',id);if(name)u.searchParams.set('name',name)}
 return u.href;
}
export function loginUrl(id=classId,name=classLabel){
 const u=new URL('./index.html',location.href);
 if(id&&UUID.test(id)){u.searchParams.set('class',id);if(name)u.searchParams.set('name',name)}
 return u.href;
}
export function getConnectedClass(){try{return localStorage.getItem(KEY)}catch{return null}}
export function setConnectedClass(id){
 try{if(id&&UUID.test(id))localStorage.setItem(KEY,id);else localStorage.removeItem(KEY)}catch{}
}
