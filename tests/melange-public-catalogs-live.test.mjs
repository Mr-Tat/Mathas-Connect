import test from 'node:test';
import assert from 'node:assert/strict';

// Lecture PUBLIQUE et anonyme uniquement, jamais de JWT ni de données élèves.
// Chaque espace doit exposer Mélange seulement après le script d'ouverture.
const base='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-catalog';
const spaces=['observation','phase1','phase2','2eco'];
const launch='https://mr-tat.github.io/Mathas-Connect/apps/calculs-melanges/';
for(const space of spaces){
  test('catalogue public '+space+' : Mélange présent et activé une fois',async()=>{
    const response=await fetch(base+'?space='+encodeURIComponent(space),{
      headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(18000)
    });
    assert.equal(response.status,200,space+' HTTP '+response.status);
    const data=await response.json();
    assert.equal(data.ok,true,space+' réponse catalog invalide');
    assert.ok(Array.isArray(data.apps),space+' apps manquantes');
    const mixed=data.apps.filter(a=>a.app_key==='melange-calculs-ecrits');
    assert.equal(mixed.length,1,space+' doit exposer exactement une carte Mélange');
    assert.equal(mixed[0].enabled,true,space+' Mélange désactivé');
    assert.equal(mixed[0].launch_url,launch,space+' mauvais lien Mélange');
    assert.equal(mixed[0].featured,false,space+' ne pas mettre Mélange en vedette');
    console.log('CONFIRMÉ HTTP 200 :',space,'Mélange activé, URL exacte, carte unique');
  });
}
