import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const base=new URL('../apps/soustraction-simple/',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
test('Greffe guidée indépendante du moteur scolaire et des deux méthodes natives',()=>{
 const native=read('game-original.html'),host=read('index.html');
 assert.equal(native.split("primaryBtn.addEventListener('click',handlePrimary);").length,2);
 assert.match(native,/function borrowPattern\(top,bottom,count\)/);
 assert.match(native,/selectedBorrowMethod\(\)/);
 assert.match(host,/if\(mode==='connected'\)\{/);
 assert.match(host,/connect-guided-written/);
 assert.doesNotMatch(native,/MathasGuidedBridge/);
});
test('Modules collectif soustraction syntaxiquement valides',()=>{
 for(const name of ['collective-contract.mjs','collective-ui.mjs','collective-draft.mjs','collective-native-bridge.js'])
  execFileSync(process.execPath,['--check',new URL(name,base).pathname]);
});
test('Code du module hôte : syntaxe valide après ajout du client collectif',()=>{
 const html=read('index.html'),code=html.split('<script type="module">')[1]?.split('</script></body></html>')[0];
 assert.ok(code&&code.length>1000);
 const tmp=mkdtempSync(join(tmpdir(),'guided-sub-'));
 try{const p=join(tmp,'host.mjs');writeFileSync(p,code);execFileSync(process.execPath,['--check',p])}
 finally{rmSync(tmp,{recursive:true,force:true})}
});
