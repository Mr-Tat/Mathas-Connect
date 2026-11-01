import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const js=read('projection-v2-theme.js');
const html=read('projection-v2.html');
const css=read('essais/projection-v2-da.css');
const portal=read('index.html');

function simulate({search='',stored=null,storageBlocked=false,domReady='loading'}={}){
 const attrs=new Map(),listeners={};
 const option={value:'neon',addEventListener(type,fn){listeners['select:'+type]=fn}};
 const document={
  readyState:domReady,
  documentElement:{
   setAttribute(name,value){attrs.set(name,value)},
   getAttribute(name){return attrs.get(name)||null}
  },
  getElementById(id){assert.equal(id,'projection-theme');return option},
  addEventListener(type,fn){listeners['document:'+type]=fn}
 };
 const writes=[];
 const window={
  location:{search},
  localStorage:{
   getItem(key){assert.equal(key,'mathas_projection_v2_theme');if(storageBlocked)throw Error('bloqué');return stored},
   setItem(key,value){assert.equal(key,'mathas_projection_v2_theme');if(storageBlocked)throw Error('bloqué');writes.push(value)}
  }
 };
 runInNewContext(js,{document,window,URLSearchParams});
 const ready=()=>listeners['document:DOMContentLoaded']?.();
 const change=value=>{option.value=value;listeners['select:change']()};
 return{attrs,option,writes,ready,change,attached:()=>!!listeners['select:change']};
}

test('V2 live : 4 thèmes réellement accessibles dans la page authentifiée',()=>{
 assert.match(html,/src="\.\/projection-v2-theme\.js\?v=20261101-1"/);
 assert.match(html,/href="\.\/essais\/projection-v2-da\.css\?v=20261101-1"/);
 assert.match(html,/class="projection-theme-picker"/);
 assert.match(html,/id="projection-theme"/);
 for(const value of ['neon','papier','ardoise','studio'])
  assert.match(html,new RegExp('<option value="'+value+'">'));
 assert.match(html,/id="header-class"/);
 assert.match(html,/id="ranking-list"/);
 assert.match(html,/✨ Nouveaux exploits/);
 assert.doesNotMatch(html,/Meilleures remontées/);
 assert.match(css,/\.projection-theme-picker select:focus-visible/);
 for(const value of ['neon','papier','ardoise','studio'])
  assert.match(css,new RegExp('html\\[data-proj-da="'+value+'"\\]'));
});

test('5 accès du professeur ouvrent la V2 en conservant la classe',()=>{
 for(const space of ['observation','phase1','phase2','phase2b','2eco'])
  assert.match(portal,new RegExp('href="\\./projection-v2\\.html\\?space='+space+'"'));
 assert.equal((portal.match(/href="\.\/projection-v2\.html\?space=/g)||[]).length,5);
 assert.doesNotMatch(portal,/href="\.\/projection\.html\?space=/);
 assert.match(read('connect-context.js'),/const space=spaces\[params\.get\('space'\)/);
 assert.match(read('projection-v2-live.js'),/classId,classLabel/);
});

test('Thème par défaut, même avant le chargement du DOM et sans appel serveur',()=>{
 const s=simulate();
 assert.equal(s.attrs.get('data-proj-da'),'neon');
 assert.equal(s.attached(),false);
 s.ready();
 assert.equal(s.attached(),true);
 assert.equal(s.option.value,'neon');
 assert.deepEqual(s.writes,['neon']);
 assert.doesNotMatch(js,/fetch\s*\(|supabase|connect-projection-v2|XMLHttpRequest|import\s*\(/i);
});

test('Priorité URL > navigateur, et choix conservé sans rechargement',()=>{
 const s=simulate({search:'?space=phase2&theme=ardoise',stored:'papier'});
 assert.equal(s.attrs.get('data-proj-da'),'ardoise');
 s.ready();
 assert.equal(s.option.value,'ardoise');
 s.change('studio');
 assert.equal(s.attrs.get('data-proj-da'),'studio');
 assert.equal(s.option.value,'studio');
 assert.deepEqual(s.writes,['ardoise','studio']);
 s.change('inconnu');
 assert.equal(s.attrs.get('data-proj-da'),'studio');
 assert.equal(s.option.value,'studio');
});

test('Reprise de la préférence, paramètre invalide et localStorage bloqué',()=>{
 const saved=simulate({stored:'papier',search:'?space=observation&theme=bidon',domReady:'complete'});
 assert.equal(saved.attrs.get('data-proj-da'),'papier');
 assert.equal(saved.attached(),true);
 const blocked=simulate({storageBlocked:true,domReady:'complete'});
 assert.equal(blocked.attrs.get('data-proj-da'),'neon');
 blocked.change('ardoise');
 assert.equal(blocked.attrs.get('data-proj-da'),'ardoise');
 assert.deepEqual(blocked.writes,[]);
});
