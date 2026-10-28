import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const engine=read('../apps/soustraction-simple/game-original.html');
const configMatch=engine.match(/window\.MathasAppConfig=(\{[^;]+\});/);
test('moteur Soustraction autonome copié avec identité et modes spécifiques',()=>{
  assert.ok(configMatch,'configuration autonome');
  const cfg=JSON.parse(configMatch[1]);
  assert.equal(cfg.appId,'soustraction-ecrite');
  assert.equal(cfg.family,'subtraction');
  assert.equal(cfg.visibleVersion,'V6.0.2');
  assert.equal(cfg.storage.normal.classic,'soustraction_classic20_v6');
  assert.equal(cfg.storage.normal.sudden,'soustraction_sudden_v6');
  assert.ok(engine.includes('addBottom') && engine.includes('takeTop'));
  assert.ok(engine.includes('soustraction_hard_sudden_v1'));
});
test('scripts internes autonomes syntaxiquement valides',()=>{
  const scripts=[...engine.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length>=25);
  for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new Script(m[1],{filename:'soustraction-'+i+'.js'}));
});
test('la matrice globale conserve la décision de visibilité',()=>{
  assert.ok(read('../hub-catalog.json').includes('soustraction-ecrite-simple'));
  assert.ok(read('../supabase/migrations/20261028_soustraction_connect_v1.sql').includes("false,'calculs_ecrits',false"));
});

test('le lanceur isole la soustraction et garde les deux techniques',()=>{
 const launcher=read('../apps/soustraction-simple/index.html');
 assert.ok(launcher.includes("APP='soustraction-ecrite-simple'"));
 assert.ok(launcher.includes("suddenMethods?.[method]"));
 assert.ok(launcher.includes("['addBottom','takeTop']"));
 assert.ok(launcher.includes("expectedResetEpoch:resetEpoch"));
 assert.ok(launcher.includes("action:'game-record'"));
});

test('contrat serveur: Soustraction et techniques isolées',()=>{
 const edge=read('../supabase/functions/connect-results/index.ts');
 const migration=read('../supabase/migrations/20261028_soustraction_connect_v1.sql');
 assert.ok(edge.includes("sub='soustraction-ecrite-simple'"));
 assert.ok(edge.includes("next.suddenMethods[b.method][i]"));
 assert.ok(edge.includes("deny('invalid_method')"));
 assert.ok(edge.includes("selected===sub&&b.mode==='sudden'"));
 assert.ok(migration.includes("'soustraction-ecrite-simple'"));
 assert.ok(migration.includes("ON CONFLICT(app_key) DO NOTHING"));
});
test('sélecteur professeur et quatre HUB pilotés par la matrice',()=>{
 const page=read('../index.html'),app=read('../app.js'),catalog=read('../hub-catalog.json');
 assert.ok(page.includes('<option value="soustraction-ecrite-simple">'));
 assert.ok(app.includes("'soustraction-ecrite-simple'"));
 assert.ok(catalog.includes('"app_key": "soustraction-ecrite-simple"'));
 for(const slug of ['observation','phase1','phase2','2eco'])assert.ok(app.includes(slug));
});
