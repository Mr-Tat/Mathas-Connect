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

test('lanceur: module JavaScript syntaxiquement exécutable',async()=>{
 const launcher=read('../apps/soustraction-simple/index.html');
 const script=launcher.split('<script type="module">')[1]?.split('</script></body>')[0];
 assert.ok(script);
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('HUB inclut Soustraction en compte professeur',()=>{const hub=read('../hub.js');assert.ok(hub.includes("'multiplication-ecrite-simple','soustraction-ecrite-simple'"));});

test('pont iframe : fermeture effective et stockage natif du moteur isolé',()=>{
 const launcher=read('../apps/soustraction-simple/index.html');
 assert.ok(launcher.includes(String.raw`<\/script>`));
 assert.ok(!launcher.includes(String.raw`<\\/script>`));
 assert.ok(launcher.includes('return /^(soustraction_|mathas_)/.test(k)?ns+k:k'));
 const standalone=read('../apps/soustraction-simple/game-original.html');
 assert.ok(standalone.includes('soustraction_classic20_v6'));
 assert.ok(standalone.includes('soustraction_sudden_v6'));
});

test('une fermeture avant le délai de trophées ne perd pas le résultat en file',()=>{
 const launcher=read('../apps/soustraction-simple/index.html');
 const staged=launcher.indexOf('pending.push(body);saveQueue(pending)');
 const rewards=launcher.indexOf('finalize:eventId=>');
 assert.ok(staged>0&&rewards>staged);
 assert.ok(launcher.includes('pilot.completed(final,{defer:true})'));
 assert.ok(launcher.includes('setTimeout(()=>pilot.finalize(eventId),750)'));
 assert.ok(launcher.includes('if(!options.defer)'));
});

test('file : acquittement ciblé, conservation des parties concurrentes et ancien parcours archivé',()=>{
 const launcher=read('../apps/soustraction-simple/index.html');
 assert.ok(launcher.includes('function removeQueuedEvent(eventId)'));
 assert.ok(launcher.includes('pending.filter(x=>x.eventId!==eventId)'));
 assert.ok(launcher.includes('removeQueuedEvent(e.eventId)'));
 assert.ok(launcher.includes("reason:'reset-epoch-changed'"));
 assert.ok(launcher.includes('archiveOldEvent(e);q=readQueue()'));
 assert.ok(launcher.includes("const staleKey=queueKey+'.previous-parcours.v1'"));
});

test('copie identique du moteur autonome (empreinte Git blob figée)',async()=>{
 const {createHash}=await import('node:crypto');
 const {readFileSync}=await import('node:fs');
 const bytes=readFileSync(new URL('../apps/soustraction-simple/game-original.html',import.meta.url));
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(sha,'7588301f21428277e5d2c9b7aa2821bf606cb27a');
});
