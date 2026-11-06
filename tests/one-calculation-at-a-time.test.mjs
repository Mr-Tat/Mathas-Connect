import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const games=[
 ['addition simple','apps/objective-record/engines/addition-simple/game-original.html','evaluateCalc'],
 ['addition multiple','apps/objective-record/engines/addition-multiple/index.html','evaluateCalc'],
 ['multiplication','apps/multiplication-simple/game-original.html','evaluate'],
 ['soustraction','apps/soustraction-simple/game-original.html','complete']
];
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

for(const [name,path,check] of games){
 test(name+' : validation séquentielle et badge non intrusif',()=>{
  const code=source(path);
  assert.match(code,/mathasGateSecondCalc\(true\)/,'le second calcul est initialement inaccessible');
  assert.match(code,/if\(secondReady&&states\[0\]\.solved\)candidates\.push\(1\)/,
   'le second calcul ne peut pas être validé avant le premier');
  assert.match(code,/mathasShowCalcVerified\(i\)/,'un badge signale la réussite');
  assert.match(code,/prefers-reduced-motion:reduce/,'animation respectueuse des préférences');
  assert.match(code,/window\.__mathasManualValidation/,'validation manuelle conservée');
  assert.match(code,/!states\[0\]\.solved&&/,'vérification automatique du premier calcul');
  assert.match(code,/states\[0\]\.solved&&!states\[1\]\.solved&&/,
   'vérification automatique du deuxième après le premier');
  if(check==='complete')assert.match(code,/const complete=i=>/,'les emprunts visibles sont vérifiés');
  else assert.ok(code.includes(check+'(0).filled')||code.includes(check+'(1).filled'));
 });
}

test('une vie perdue en multiplication ne montre jamais de badge correct',()=>{
 const sourceText=source('apps/multiplication-simple/game-original.html');
 assert.match(sourceText,/if\(evaluate\(i\)\.correct\)mathasShowCalcVerified\(i\)/);
 assert.match(source('apps/multiplication-simple/native-proof-adapter.mjs'),/markErrors\(i\);lockCalc\(i\)/,
  'le cas particulier du verrouillage après erreur certifiée reste pris en compte');
});
