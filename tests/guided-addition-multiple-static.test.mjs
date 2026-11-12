import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const base=new URL('../apps/addition-plusieurs/',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
test('Moteur multi-termes authentique préservé, greffe sur ancrage natif unique',()=>{
 const engine=read('game-original.html'),host=read('index.html');
 assert.equal(engine.split("primaryBtn.addEventListener('click',handlePrimary);").length,2);
 assert.match(engine,/function generateAddition\(maxDigits,addendCount,minDigits\)/);
 assert.match(engine,/function addendCountForLevel\(level\)/);
 assert.doesNotMatch(engine,/MathasGuidedBridge/);
 assert.match(host,/connect-guided-written/);
 assert.match(host,/MathasGuidedBridge/);
});
test('Syntaxe des modules du guidé multiple',()=>{
 for(const name of ['collective-contract.mjs','collective-ui.mjs','collective-draft.mjs','collective-native-bridge.js'])
  execFileSync(process.execPath,['--check',new URL(name,base).pathname]);
});
test('Script hôte module syntaxiquement valide',()=>{
 const html=read('index.html'),code=html.split('<script type="module">')[1]?.split('</script></body></html>')[0];
 assert.ok(code&&code.length>1000);
 const tmp=mkdtempSync(join(tmpdir(),'guided-multi-'));
 try{const p=join(tmp,'entry.mjs');writeFileSync(p,code);execFileSync(process.execPath,['--check',p])}
 finally{rmSync(tmp,{recursive:true,force:true})}
});
