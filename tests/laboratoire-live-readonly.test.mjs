import test from 'node:test';
import assert from 'node:assert/strict';

// Tests HTTP PUBLICS uniquement : ne crée ni session, ni élève, ni XP.
// Aucune donnée d'élève, aucun token personnel requis.
const base='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-lab-catalog';
const uuid='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const get=async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});
 const data=await r.json();
 return {status:r.status,data};
};
test('l’Edge du laboratoire ne livre que les applications explicitement affichées',async()=>{
 const {status,data}=await get(base+'?class='+uuid);
 assert.equal(status,200,JSON.stringify(data));
 assert.equal(data.ok,true);
 assert.ok(Array.isArray(data.apps));
 for(const app of data.apps){
  assert.equal(app.enabled,true);
  assert.equal(app.visible,true);
  assert.notEqual(app.app_key,'connect-lab');
 }
});
test('un mauvais identifiant de classe ne donne aucun catalogue',async()=>{
 const {status,data}=await get(base+'?class=00000000-0000-4000-8000-000000000001');
 assert.equal(status,403,JSON.stringify(data));
 assert.equal(data.ok,false);
});
test('un POST sans session professeur est refusé',async()=>{
 const r=await fetch(base,{
  method:'POST',signal:AbortSignal.timeout(12000),
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'list',classId:uuid})
 });
 const data=await r.json();
 assert.equal(r.status,401,JSON.stringify(data));
 assert.equal(data.ok,false);
});
