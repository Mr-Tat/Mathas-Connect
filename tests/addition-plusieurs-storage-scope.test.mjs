import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/addition-plusieurs/storage-scope.js',import.meta.url),'utf8');
function mount(scope,sharedLocal){
 class FakeStorage {
  constructor(raw){this.raw=raw}
  getItem(k){return this.raw.get(String(k))??null}
  setItem(k,v){this.raw.set(String(k),String(v))}
  removeItem(k){this.raw.delete(String(k))}
 }
 const localStorage=new FakeStorage(sharedLocal);
 const sessionStorage=new FakeStorage(new Map());
 const window={frameElement:{getAttribute:key=>key==='data-mathas-storage-scope'?scope:null}};
 runInNewContext(source,{window,Storage:FakeStorage,localStorage,sessionStorage});
 return {localStorage,sessionStorage,window};
}
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('different pupils in one class cannot see each other native local records',()=>{
 const shared=new Map();
 const first=mount('connect.'+a+'.'+b,shared);
 const second=mount('connect.'+a+'.'+c,shared);
 first.localStorage.setItem('addition2_classic_v1','pupil-B');
 first.localStorage.setItem('mathas_trophies_v3_addition-plusieurs','trophy-B');
 assert.equal(second.localStorage.getItem('addition2_classic_v1'),null);
 assert.equal(second.localStorage.getItem('mathas_trophies_v3_addition-plusieurs'),null);
 second.localStorage.setItem('addition2_classic_v1','pupil-C');
 assert.equal(first.localStorage.getItem('addition2_classic_v1'),'pupil-B');
 assert.equal(shared.get('addition2_classic_v1'),undefined);
});
test('same pupil in another class and free mode are independently scoped',()=>{
 const shared=new Map();
 const pupil=mount('connect.'+a+'.'+b,shared);
 const differentClass=mount('connect.'+c+'.'+b,shared);
 const free=mount('libre',shared);
 pupil.localStorage.setItem('mathas_progression_addition_plusieurs_v1','saved');
 assert.equal(differentClass.localStorage.getItem('mathas_progression_addition_plusieurs_v1'),null);
 assert.equal(free.localStorage.getItem('mathas_progression_addition_plusieurs_v1'),null);
 // HUB keys and generic unrelated keys are not intercepted.
 pupil.localStorage.setItem('mathas.connect.mode-libre.v1','1');
 assert.equal(shared.get('mathas.connect.mode-libre.v1'),'1');
});
test('master-mode session state is separate between pupils',()=>{
 const shared=new Map();
 const first=mount('connect.'+a+'.'+b,shared);
 const second=mount('connect.'+a+'.'+c,shared);
 first.sessionStorage.setItem('mathas_master_mode_session_v1_/apps/addition-plusieurs/','1');
 assert.equal(second.sessionStorage.getItem('mathas_master_mode_session_v1_/apps/addition-plusieurs/'),null);
 first.sessionStorage.removeItem('mathas_master_mode_session_v1_/apps/addition-plusieurs/');
 assert.equal(first.sessionStorage.getItem('mathas_master_mode_session_v1_/apps/addition-plusieurs/'),null);
});
test('invalid or missing scope refuses native game initialization',()=>{
 const shared=new Map();
 for(const scope of [null,'connect..pupil','evil/path','A'.repeat(60)]){
  assert.throws(()=>mount(scope,shared),/invalid_mathas_storage_scope/);
 }
});
