// État du HUB : identifiant de classe public, jamais un droit d'accès.
const KEY='mathas.connect.active-class.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const params=new URLSearchParams(location.search);
export const classId=UUID.test(params.get('class')||'')?params.get('class'):null;
export const classLabel=(params.get('name')||'').trim().slice(0,80)||'Ma classe';
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
