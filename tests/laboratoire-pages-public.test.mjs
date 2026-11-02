import test from 'node:test';
import assert from 'node:assert/strict';
import {objectiveRecordLabPreviews} from '../objective-record-lab-previews.mjs';

// Test HTTP public, lecture seule. Aucun compte Connect, JWT ou XP n'est utilisé.
// Vérifie le contenu effectivement servi par Pages, pas le contenu supposé de GitHub main.
const previews=objectiveRecordLabPreviews.filter(p=>p.id!=='abaque-longueurs');
const markers=[
  'window.MathasLabV2.patch',
  'lab-objectif-record-v2.js',
];
const get=async (url)=>{
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const res=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(15000)});
      assert.equal(res.status,200,'HTTP '+res.status+' : '+url);
      assert.equal(new URL(res.url).hostname,'mr-tat.github.io','Redirection hors GitHub Pages');
      const text=await res.text();
      assert.ok(text.length>900,'Réponse trop courte : '+url);
      return text;
    }catch(error){
      lastError=error;
      if(attempt===0)await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }
  throw lastError;
};

test('Pages hébergées : cinq essais disponibles, isolés et au style V5',async t=>{
  assert.equal(previews.length,5,'Exactement cinq essais Objectif record');
  for(const preview of previews){
    await t.test(preview.title,async()=>{
      const page=await get(preview.url);
      assert.match(page,/<iframe\b[^>]*id=["']game["']/i,'Iframe du moteur présente');
      assert.match(page,/Réseau désactivé|Réseau bloqué|Aucun compte|aucun compte/i,'Prototype isolé : aucune écriture élève');
      assert.ok(markers.every(marker=>page.includes(marker)), 'Injection du laboratoire attendue sur '+preview.url);

      const url=new URL(preview.url);
      const script=await get(new URL('lab-objectif-record-v2.js',url).href);
      for(const marker of ['LAB V4','LAB V5','mlab-score-awards','mathas-trophies-footer']){
        assert.ok(script.includes(marker),'Version du laboratoire non publiée : '+preview.title+' / '+marker);
      }
      const native=preview.id==='addition-simple'?'game-original.html':'index.html';
      const game=await get(new URL(native,url).href);
      assert.match(game,/MathasAppConfig|function validateNormal\(/,'Moteur réel non servi : '+preview.title);
    });
  }
});

test('Pages hébergées : le catalogue du laboratoire reste séparé des jeux officiels',async()=>{
  const hub=await get('https://mr-tat.github.io/Mathas-Connect/hub.js');
  const list=await get('https://mr-tat.github.io/Mathas-Connect/objective-record-lab-previews.mjs');
  assert.match(hub,/objectiveRecordLabPreviews/);
  assert.match(hub,/classId===LAB_CLASS/);
  assert.match(list,/XP fictifs|Démonstrations publiées sur Pages/);
  for(const {url} of previews)assert.ok(list.includes(url),'Carte absente du HUB en ligne : '+url);
});


test('LAB pilote Connect : la page publique et son pont sont servis',async()=>{
 const page=await get('https://mr-tat.github.io/Mathas-Connect/essais/objectif-record-pilote.html');
 const js=await get('https://mr-tat.github.io/Mathas-Connect/essais/objectif-record-pilote.js');
 assert.match(page,/pilote Connect authentifi/i);
 assert.match(page,/id="gameFrame"/);
 assert.match(js,/connect-record-pilot/);
 assert.match(js,/classId:TEST/);
 assert.match(js,/MathasLabV2Update/);
 assert.match(js,/expectedStudentId:studentId/);
});
test('LAB pilote Connect : rejet sans compte, aucune écriture anonyme',async()=>{
 const endpoint='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-record-pilot';
 const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(15000),
   headers:{'content-type':'application/json'},body:JSON.stringify({action:'record',classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',appKey:'addition-ecrite-simple'})});
 assert.ok([401,403].includes(response.status),'Rejet JWT attendu, statut '+response.status);
});
