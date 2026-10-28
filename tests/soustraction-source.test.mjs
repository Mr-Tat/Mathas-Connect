import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const engine=read('../apps/soustraction-simple/game-original.html');
const configMatch=engine.match(/window\\.MathasAppConfig=(\\{[^;]+\\});/);
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
  const scripts=[...engine.matchAll(new RegExp('<script(?:\\s[^>]*)?>([\\s\\S]*?)</script>','gi'))];
  assert.ok(scripts.length>=25);
  for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new Script(m[1],{filename:'soustraction-'+i+'.js'}));
});
test('original en attente de lanceur : aucune publication prématurée',()=>{
  assert.ok(!read('../hub-catalog.json').includes('soustraction-ecrite-simple'));
});
