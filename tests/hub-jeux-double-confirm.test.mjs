import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const hub=read('../hub.js');
const css=read('../hub.css');

function simulation(random=()=>0.1) {
  const document={activeElement:null,listeners:new Map()};
  class Element {
    constructor(tag) {
      this.tag=tag;
      this.children=[];
      this.listeners=new Map();
      this.attributes={};
    }
    append(...nodes) {this.children.push(...nodes)}
    appendChild(node) {this.append(node)}
    get firstElementChild(){return this.children[0]}
    get lastElementChild(){return this.children.at(-1)}
    setAttribute(name,value){this.attributes[name]=value}
    focus(){document.activeElement=this}
    remove(){document.body.children=document.body.children.filter(x=>x!==this)}
    addEventListener(type,fn){this.listeners.set(type,fn)}
    click(){this.listeners.get('click')?.({target:this})}
  }
  document.body=new Element('body');
  document.createElement=tag=>new Element(tag);
  document.addEventListener=(type,fn)=>document.listeners.set(type,fn);
  document.removeEventListener=type=>document.listeners.delete(type);
  const start=hub.indexOf('function askJeuxQuestion(');
  const end=hub.indexOf('// Les démos ne reçoivent pas',start);
  assert.ok(start>0 && end>start,'fonctions de confirmation présentes');
  const functions=runInNewContext(hub.slice(start,end)+';({confirmJeuxOpening})',
    {document,Math:{random},Promise});
  const dialog=()=>{
    assert.equal(document.body.children.length,1,'une seule fenêtre à la fois');
    const backdrop=document.body.children[0];
    const bubble=backdrop.children[0];
    const question=bubble.children[0];
    const buttons=bubble.children[1].children;
    return {backdrop,bubble,question,buttons,click:label=>{
      const btn=buttons.find(x=>x.textContent===label);
      assert.ok(btn,'bouton '+label+' absent');
      btn.click();
    }};
  };
  return {document,dialog,open:functions.confirmJeuxOpening};
}

test('Jeux : double confirmation et permutation certaine des boutons',async()=>{
  const sim=simulation(()=>0.1);
  const answer=sim.open();
  const first=sim.dialog();
  assert.equal(first.question.textContent,"Ton prof t'a dit que tu pouvais ?");
  assert.deepEqual(first.buttons.map(x=>x.textContent),['Oui','Non']);
  assert.equal(sim.document.activeElement,first.bubble,'ne pas pré-sélectionner Oui');
  first.click('Oui');
  await Promise.resolve();
  const second=sim.dialog();
  assert.equal(second.question.textContent,'Tu es sûr ?');
  assert.deepEqual(second.buttons.map(x=>x.textContent),['Non','Oui']);
  assert.equal(sim.document.activeElement,second.bubble);
  second.click('Oui');
  assert.equal(await answer,true);
  assert.equal(sim.document.body.children.length,0,'nettoyage de la fenêtre');
  assert.equal(sim.document.listeners.size,0,'pas de listener permanent');
});

test('Jeux : Non à la première ou seconde question refuse l’ouverture',async()=>{
  for(const stopAt of [1,2]){
    const sim=simulation(()=>0.9);
    const answer=sim.open();
    const first=sim.dialog();
    assert.deepEqual(first.buttons.map(x=>x.textContent),['Non','Oui']);
    first.click(stopAt===1?'Non':'Oui');
    if(stopAt===2){
      await Promise.resolve();
      const second=sim.dialog();
      assert.deepEqual(second.buttons.map(x=>x.textContent),['Oui','Non']);
      second.click('Non');
    }
    assert.equal(await answer,false);
    assert.equal(sim.document.body.children.length,0);
  }
});

test('Jeux : Echap ou clic hors de la bulle annule, sans bouton Oui accentué',async()=>{
  const sim=simulation();
  const answer=sim.open();
  let prevented=false;
  sim.document.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(await answer,false);
  assert.equal(sim.document.body.children.length,0);
  const sim2=simulation();
  const answer2=sim2.open();
  const {backdrop}=sim2.dialog();
  backdrop.listeners.get('click')({target:backdrop});
  assert.equal(await answer2,false);
  assert.match(css,/\/\* Les choix Oui \/ Non sont volontairement visuellement identiques\. \*\//);
  assert.doesNotMatch(css,/\.jeux-confirm-btn\.yes|\.jeux-confirm-btn\.oui/);
});

test('Jeux : rubrique initialement repliée, garde-fou seulement à son ouverture',()=>{
  assert.match(hub,/if \(\['objectif', 'calculs_ecrits', 'outil', 'record_lab'\]\.includes\(kind\)\)/);
  assert.match(hub,/if\(kind==='jeux'\)\{/);
  assert.match(hub,/if\(!await confirmJeuxOpening\(\)\)return;/);
  assert.match(hub,/if\(!node\.isConnected\)return;/);
  assert.match(hub,/jeuxConfirmationPending=true/);
  assert.match(hub,/toggle\.focus\(\{preventScroll:true\}\)/);
  assert.match(hub,/return askJeuxQuestion\('Tu es sûr \?',!yesOnLeft\)/);
  assert.doesNotMatch(hub,/setInterval\(/);
});
