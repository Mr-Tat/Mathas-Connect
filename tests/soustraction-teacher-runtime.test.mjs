import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function showOverviewDetail(');
const end=app.indexOf('async function showResults()',start);
assert.ok(start>=0&&end>start,'fonction de résultats professeur identifiable');
const functionSource=app.slice(start,end);

function node(tag){
 return {
  tag,children:[],textContent:'',className:'',hidden:false,
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items}
 };
}
function setup(){
 const ids=new Map();
 const $=id=>{if(!ids.has(id))ids.set(id,node('div'));return ids.get(id)};
 const restartCalls=[];
 const context=vm.createContext({
  document:{createElement:node},$,
  makeOverviewCell:()=>node('summary'),
  addParcoursControls:(...a)=>restartCalls.push(a),
  String
 });
 vm.runInContext(functionSource+';globalThis.showOverviewDetailRun=showOverviewDetail;',context);
 const walk=n=>[n,...n.children.flatMap(walk)];
 return {view:context.showOverviewDetailRun,ids,$,restartCalls,walk};
}
const student={id:'fake',displayName:'Élève fictif',
 apps:[
  {appKey:'soustraction-ecrite-simple',state:{
   classic:[{'4':4,'10':9,'20':18},{},{}],
   sudden:[8,null,null],suddenMethods:{addBottom:[5,null,null],takeTop:[8,null,null]},
   hard:[3,null,null],hardThree:[4,null,null]}},
  {appKey:'addition-ecrite-simple',state:{
   classic:[{'4':4},{},{}],sudden:[5,null,null],hard:[2,null,null],hardThree:[3,null,null]}}
 ]};
test('tableau professeur Soustraction : deux colonnes Mort subite séparées, aucun ReferenceError',()=>{
 const h=setup();
 h.view(student,[{app_key:'soustraction-ecrite-simple',title:'Soustraction écrite'}],true);
 const rows=h.walk(h.$('results-student-content')).filter(n=>n.tag==='tr');
 assert.equal(rows.length,4);
 assert.deepEqual(rows[0].children.map(n=>n.textContent),[
  'Niveau','/4','/10','/20','Mort subite',
  'Mort subite · Compensation','Mort subite · Emprunt direct','HARD','HARD 5 calculs'
 ]);
 assert.deepEqual(rows[1].children.map(n=>n.textContent),[
  'Niveau 1','4/4','9/10','18/20','8','5','8','3','4/5'
 ]);
 assert.equal(h.restartCalls.length,1);
 assert.equal(h.restartCalls[0][3],'soustraction-ecrite-simple');
});
test('tableau professeur Addition : aucune colonne technique Soustraction ajoutée',()=>{
 const h=setup();
 h.view(student,[{app_key:'addition-ecrite-simple',title:'Addition écrite'}],true);
 const rows=h.walk(h.$('results-student-content')).filter(n=>n.tag==='tr');
 assert.equal(rows.length,4);
 assert.equal(rows[0].children.length,7);
 assert.equal(rows[1].children.length,7);
 assert.equal(h.restartCalls[0][3],'addition-ecrite-simple');
});

test('GLOBAL : lien de test Soustraction réservé au profil Monsieur T et à la classe choisie',()=>{
 const start=app.indexOf("   if(app.app_key==='soustraction-ecrite-simple'&&href){");
 const end=app.indexOf("   const img=document.createElement('img');",start);
 assert.ok(start>=0&&end>start,'bloc du lien professeur présent dans GLOBAL');
 const context=vm.createContext({URL,location:{href:'https://mr-tat.github.io/Mathas-Connect/index.html'},teacherPlayerActive:false,
   $:id=>id==='class-selector'?{value:'22222222-2222-4222-8222-222222222222'}:null});
 const factory=vm.runInContext('(function(app,href,link,info){'+app.slice(start,end)+';return link;})',context);
 const notifications=[],info=(message,error)=>notifications.push({message,error});
 const url='https://mr-tat.github.io/Mathas-Connect/apps/soustraction-simple/';
 const link={href:url};
 factory({app_key:'soustraction-ecrite-simple'},url,link,info);
 let prevented=false;
 link.onclick({preventDefault(){prevented=true}});
 assert.equal(prevented,true,'sans Monsieur T la page ne s’ouvre pas');
 assert.equal(link.href,url,'pas de faux compte élève');
 vm.runInContext('teacherPlayerActive=true',context);
 prevented=false;link.onclick({preventDefault(){prevented=true}});
 assert.equal(prevented,false,'Monsieur T connecté peut ouvrir le jeu');
 const target=new URL(link.href);
 assert.equal(target.searchParams.get('class'),'22222222-2222-4222-8222-222222222222');
 assert.equal(target.searchParams.get('joueur'),'prof');
 const other={href:'https://example.org/multiplication/'};
 factory({app_key:'multiplication-ecrite-simple'},other.href,other,info);
 assert.equal(other.onclick,undefined,'Multiplication inchangée');
});
