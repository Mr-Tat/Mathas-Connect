import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {injectNativeMultiplicationProof} from '../apps/multiplication-simple/native-proof-adapter.mjs';
import {multiplicationEndState} from '../apps/multiplication-simple/certified-classic.mjs';

const path=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const original=path('apps/multiplication-simple/game-original.html');
const adapted=injectNativeMultiplicationProof(original);
test('the original free engine stays byte-for-byte unmodified and connected instrumentation is separate',()=>{
 assert.ok(original.length>500000);
 assert.notEqual(adapted,original);
 assert.ok(adapted.includes('window.MathasNativeCertifiedBridge=Object.freeze'));
 assert.ok(!original.includes('window.MathasNativeCertifiedBridge=Object.freeze'));
 const launcher=path('apps/multiplication-simple/index.html');
 assert.match(launcher,/if\(mode==='connected'\)html=injectNativeMultiplicationProof\(html\)/);
 assert.match(launcher,/createNativeCertifiedMultiplication/);
 assert.doesNotMatch(launcher,/createCertifiedMultiplicationClassic\(\{/);
 assert.match(launcher,/game-original\.html/);
});
test('native script still parses with server-issued operands and attempt hooks',()=>{
 const start=adapted.indexOf('<script>\n(()=>{\n  const $=id=>');
 const end=adapted.indexOf('\n})();\n</script>',start);
 assert.ok(start>0&&end>start,'main closure exists');
 const js=adapted.slice(start+'<script>\n'.length,end+5);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/const proof=proofFeed\?\.active\?/);
 assert.match(js,/proofFeed\.cursor\+\+/);
 assert.match(js,/mathasProofCapture\(states\[i\]\)/);
 assert.match(js,/mathasProofHardCapture\(\)/);
 assert.match(js,/function makePair/);
 assert.match(js,/function renderCalc/);
 assert.match(js,/function renderHardCalc/);
 assert.match(js,/proofFeed\?\.run.mode==='three-lives'/);
 assert.match(js,/proofFeed\?\.run.mode==='hard-three-lives'/);
});
test('fail closed if the certified native engine changes its insertion anchors',()=>{
 assert.throws(()=>injectNativeMultiplicationProof(original.replace(
  'let session=null,states=[],active={kind:\'answer\',calc:0,col:0},phase=\'menu\',tablesOpen=false;',
  'let session=null,states=[],phase=\'menu\',tablesOpen=false;'
 )));
});
test('proof progress cannot earn points on invalid attempts or double credit three lives',()=>{
 const q=[{id:'q1',a:'31',m:8},{id:'q2',a:'31',m:8}];
 const right=(id)=>({id,digits:['8','4','2'],carries:['','']});
 const wrong=(id)=>({id,digits:['7','4','2'],carries:['','']});
 const classic=multiplicationEndState('classic',[right('q1'),wrong('q2')],q);
 assert.equal(classic.correct,1);
 assert.equal(classic.complete,true);
 const survival=multiplicationEndState('sudden',[wrong('q1')],q);
 assert.equal(survival.complete,true);
 const lives=multiplicationEndState('three-lives',[wrong('q1'),right('q2')],q);
 assert.equal(lives.complete,false);
});
