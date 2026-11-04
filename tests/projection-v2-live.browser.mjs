import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const A='1b021ed9-4846-4203-9c7b-4b5fa8d7adab',B='0d8ba828-59cc-468b-a4b8-7b2a1af10b88';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const stub=String.raw`
let session={user:{id:'teacher-test',is_anonymous:false},access_token:'FAKE_JWT_NEVER_ACCEPTED_BY_PRODUCTION'};
const listeners=[];
window.__signOut=()=>{session=null;listeners.forEach(x=>x('SIGNED_OUT',null))};
export function createClient(){return {auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:callback=>{listeners.push(callback);return {data:{subscription:{unsubscribe(){}}}}}}}}
`;
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return}
  try{const file=await readFile(target);res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream','cache-control':'no-store'}).end(file)}
  catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
const fakeExploitEvents=[
 {appKey:'addition-ecrite-simple',type:'trophy',message:'Élève 1 gagne un nouveau trophée !',at:'2026-11-04T00:00:00Z'},
 {appKey:'addition-ecrite-simple',type:'perfect',message:'Élève 2 réussit une série parfaite !',at:'2026-11-04T00:01:00Z'},
 {appKey:'soustraction-ecrite-simple',type:'top',message:'Élève 3 réalise un score du Top 5 !',at:'2026-11-04T00:02:00Z'}
];
function fakeStudent(i){
 return {id:'fake-student-'+i,name:'Élève '+(i+1),level:4,trophies:i%4,
  avatar:i===0?{kind:'letter',value:'É',color:'transparent'}:
   i===1?{kind:'animal',value:'fox',color:'fuchsia'}:
   i===2?{kind:'object',value:'rocket',color:'electric'}:null,
  scores:[{appKey:'addition-ecrite-simple',bestScore:220-i*10},
  {appKey:'multiplication-ecrite-simple',bestScore:90-i*3},
  {appKey:'soustraction-ecrite-simple',bestScore:120-i*5}]};
}

const ADD='addition-ecrite-simple',MUL='multiplication-ecrite-simple',SUB='soustraction-ecrite-simple';
const card=key=>'.ranking-card[data-app-key="'+key+'"]';
function sampleOptions(keys){return {scoreApps:[...keys],percentageApps:[ADD,MUL,SUB],
 comparisons:[],comparisonDisplay:[],rotationSeconds:40}}
function sampleState(keys,count=16){return {options:sampleOptions(keys),count,loads:0,saves:0,resets:[],improved:false}}
async function openBoard(page,url,state){
 const errors=[],unknown=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/*',async route=>{
  const target=route.request().url();
  if(target.startsWith(url))return route.continue();
  if(target.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',
   headers:{'access-control-allow-origin':'*'},body:stub});
  if(target.includes('.supabase.co/functions/v1/')){
   const input=JSON.parse(route.request().postData()||'{}');
   if(input.action==='teacher-dashboard')return route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify({ok:true,classes:[{id:A,name:'Phase 2 A'},{id:B,name:'Phase 2 B'}]})});
   if(input.action==='teacher-load'){
    state.loads++;
    const students=Array.from({length:state.count},(_,i)=>{
     const p=fakeStudent(i);
     if(Array.isArray(state.tieScores)){
      p.scores.find(x=>x.appKey===ADD).bestScore=state.tieScores[i]??220-i*10;
     }
     if(state.longName&&i===0)p.name=state.longName;
     if(state.improved&&i===4)p.scores.find(x=>x.appKey===SUB).bestScore=210;
     return p;
    });
    const classes=[{classId:A,name:'Phase 2 A',enrolled:state.count,options:state.options,
     students,scorePeriods:[],totals:[],percentages:null}];
    if(input.comparisons?.includes(B))classes.push({
     classId:B,name:'Phase 2 B',enrolled:0,options:null,students:[],scorePeriods:[],totals:[],percentages:null
    });
    return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},
     body:JSON.stringify({ok:true,classes,exploits:fakeExploitEvents,exploitsStatus:'available'})});
   }
   if(input.action==='teacher-save-options'){
    assert.equal(input.classId,A);
    assert.ok(input.options.scoreApps.length>=1&&input.options.scoreApps.length<=3);
    state.options=input.options;state.saves++;
    return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,options:state.options})});
   }
   if(input.action==='teacher-reset-score'){
    assert.equal(input.classId,A);assert.equal(input.password,'MOT-DE-PASSE-FICTIF');
    state.resets.push(input.appKey);
    return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},
     body:JSON.stringify({ok:true,classId:A,appKey:input.appKey,scoreSince:'2026-10-31T20:00:00Z'})});
   }
  }
  unknown.push(target);return route.abort();
 });
 await page.goto(url+'/projection-v2.html?space=phase2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#load-real').disabled);
 assert.equal(await page.locator('.ranking-card').count(),0,'Aucun élève projeté sans accord professeur');
 await page.locator('#load-real').click();
 await page.waitForFunction(()=>document.querySelector('.ranking-card'));
 return {errors,unknown};
}

test('V2 — 1, 2 et 3 panneaux, colonnes, séparation, scroll et limite de sélection',{timeout:80000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD]);
  const {errors,unknown}=await openBoard(page,url,state);
  await page.waitForFunction(()=>document.querySelectorAll('.ranking-card .entry').length===16);
  assert.equal(await page.locator('.ranking-card').count(),1);
  assert.equal(await page.locator(card(ADD)+' .ranking-col').count(),2,'Seul : deux colonnes');
  assert.equal(await page.locator(card(ADD)+' .ranking-col').first().locator('.entry').count(),8);
  await page.locator('#settings-left').click();
  await page.getByRole('checkbox',{name:'Multiplication écrite · Afficher score'}).check();
  await page.waitForFunction(()=>document.querySelectorAll('.ranking-card').length===2);
  assert.equal(await page.locator(card(MUL)+' .ranking-col').count(),2,'Deux : deux colonnes par appli');
  assert.equal(await page.locator(card(ADD)+' .entry.rank-1 .points').textContent(),'220 pts');
  assert.equal(await page.locator(card(MUL)+' .entry.rank-1 .points').textContent(),'90 pts');
  // La réussite reste à GAUCHE et les exploits à DROITE, jamais en dessous.
  const verifySidebars=async count=>{
   const rects=await page.evaluate(()=>{
    const get=selector=>{
     const r=document.querySelector(selector).getBoundingClientRect();
     return {x:r.left,right:r.right,top:r.top,width:r.width};
    };
    return {left:get('.left-col'),board:get('#ranking-board'),right:get('.right')};
   });
   assert.ok(rects.left.right+5<=rects.board.x,
    'Mode '+count+' : bloc Réussite à gauche, non placé en dessous');
   assert.ok(rects.board.right+5<=rects.right.x,
    'Mode '+count+' : bloc Exploits à droite, non placé en dessous');
   assert.ok(Math.abs(rects.left.top-rects.board.top)<16&&Math.abs(rects.right.top-rects.board.top)<16,
    'Mode '+count+' : panneaux latéraux alignés en haut');
   assert.ok(rects.left.width>=150&&rects.right.width>=150,
    'Mode '+count+' : panneaux latéraux assez larges pour les intitulés');
  };
  await verifySidebars(2);
  await page.getByRole('checkbox',{name:'Soustraction écrite · Afficher score'}).check();
  await page.waitForFunction(()=>document.querySelectorAll('.ranking-card').length===3);
  assert.equal(await page.locator('#projection-main').getAttribute('data-app-count'),'3');
  for(const key of [ADD,MUL,SUB]){
   assert.equal(await page.locator(card(key)+' .ranking-col').count(),1,'Trois : une seule colonne');
   assert.equal(await page.locator(card(key)+' .entry').count(),16);
  }
  await verifySidebars(3);
  assert.equal(await page.getByRole('checkbox',{name:'Addition multiple · Afficher score'}).isDisabled(),true,
   'Impossible de choisir une quatrième appli');
  assert.equal(await page.getByRole('checkbox',{name:'Addition multiple · Afficher pourcentage'}).isDisabled(),false,
   'Les % sont indépendants des scores');
  const boxes=await page.locator('.ranking-card').evaluateAll(cards=>cards.map(x=>{
   const r=x.getBoundingClientRect();return {left:r.left,right:r.right,border:getComputedStyle(x).borderWidth,height:r.height}
  }));
  assert.ok(boxes[0].right+8<=boxes[1].left&&boxes[1].right+8<=boxes[2].left,
   'Trois panneaux côte à côte avec gouttières visibles');
  assert.ok(boxes.every(x=>x.border==='3px'),'Contours épais');
  await page.locator('#close-settings').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+100),'Défilement de la page possible');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'Pas de scroll horizontal');
  assert.equal(await page.locator('#projection-refresh-dot').count(),0,'Point supprimé');
  assert.equal(await page.locator('#next-app').count(),0,'Pas de rotation automatique');
  await page.locator('#settings-left').click();
  await page.getByRole('checkbox',{name:'Soustraction écrite · Afficher score'}).uncheck();
  await page.getByRole('checkbox',{name:'Multiplication écrite · Afficher score'}).uncheck();
  await page.waitForFunction(()=>document.querySelectorAll('.ranking-card').length===1);
  assert.equal(await page.getByRole('checkbox',{name:'Addition écrite · Afficher score'}).isDisabled(),true,
   'Impossible de supprimer le dernier classement');
  await page.locator('#close-settings').click();
  await page.evaluate(()=>window.__signOut());
  assert.equal(await page.locator('.ranking-card').count(),0,'Données masquées à la déconnexion');
  assert.ok(state.saves>=4);assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — animations de remontée indépendantes, aucun score mélangé',{timeout:60000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,SUB],5);
  const {errors}=await openBoard(page,url,state);
  await page.waitForFunction(()=>document.querySelectorAll('.ranking-card .entry').length===10);
  assert.equal(await page.locator(card(SUB)+' .entry.rank-1 .player-label strong').textContent(),'Élève 1');
  state.improved=true;
  await page.locator('#load-real').click();
  await page.waitForFunction(key=>Number(document.querySelector('[data-app-key="'+key+'"] .ranking-list')?.dataset.overtakeSteps||0)>=4,
   SUB,{timeout:12000});
  assert.equal(await page.locator(card(SUB)+' .entry.rank-1 .player-label strong').textContent(),'Élève 5');
  assert.equal(await page.locator(card(ADD)+' .entry.rank-1 .player-label strong').textContent(),'Élève 1');
  assert.equal(await page.locator(card(ADD)+' .ranking-list').evaluate(e=>Number(e.dataset.overtakeSteps||0)),0);
  await page.waitForFunction(()=>document.querySelector('#exploits')?.textContent?.includes('remonte de 4 places'));
  assert.match(await page.locator('#exploits').textContent(),/Soustraction écrite/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — lecture automatique toutes les 20 s sans rotation',{timeout:60000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL,SUB],3);
  await page.clock.install();
  const {errors}=await openBoard(page,url,state);
  assert.equal(state.loads,1);
  await page.clock.fastForward(21000);
  await new Promise(ok=>setTimeout(ok,250));
  assert.ok(state.loads>=2,'MAJ après vingt secondes');
  await page.clock.fastForward(21000);
  await new Promise(ok=>setTimeout(ok,250));
  assert.ok(state.loads>=3,'Seconde MAJ après quarante secondes');
  assert.deepEqual(await page.locator('.ranking-head h2').allTextContents(),
   ['Addition écrite','Multiplication écrite','Soustraction écrite']);
  assert.equal(await page.locator('.ranking-card').count(),3);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — reset de score toujours protégé et isolé',{timeout:60000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL],4);
  const {errors}=await openBoard(page,url,state);
  await page.locator('#settings-left').click();
  await page.getByRole('button',{name:'Réinitialiser uniquement le score de Addition écrite pour Phase 2 A'}).click();
  await page.locator('#reset-password').fill('MOT-DE-PASSE-FICTIF');
  await page.locator('#reset-apply').click();
  await page.waitForFunction(()=>!document.querySelector('#settings').open);
  assert.deepEqual(state.resets,[ADD]);
  assert.equal(await page.locator(card(MUL)+' .entry.rank-1 .points').textContent(),'90 pts');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — barre du haut : thème à gauche, classe centrale et MAJ/barre à droite',{timeout:65000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL],5);
  const {errors}=await openBoard(page,url,state);
  assert.equal(await page.locator('#settings-top').count(),0,'Le bouton Applications du haut a disparu');
  assert.equal(await page.locator('#settings-left').count(),1,'Celui de gauche reste accessible');
  assert.equal(await page.locator('#projection-refresh-countdown').count(),0,'Plus de texte chrono');
  assert.equal(await page.locator('#projection-refresh-progress[role="progressbar"]').count(),1);
  for(const theme of ['neon','papier','ardoise','studio']){
   await page.locator('#projection-theme').selectOption(theme);
   const geo=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();
     return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,mid:(r.left+r.right)/2}};
    return {header:rect('header'),theme:rect('#projection-theme'),klass:rect('#header-class'),
     button:rect('#load-real'),progress:rect('#projection-refresh-progress'),viewport:innerWidth};
   });
   assert.ok(geo.theme.right+12<geo.klass.left,'Thème à gauche de la classe : '+theme);
   assert.ok(geo.klass.right+12<geo.button.left,'Classe au centre, boutons à droite : '+theme);
   assert.ok(geo.button.right+5<geo.progress.left,'Actualiser collé à la barre : '+theme);
   assert.ok(geo.button.top<geo.header.bottom&&geo.progress.bottom<=geo.header.bottom,'Commandes dans le bandeau : '+theme);
   assert.ok(Math.abs(geo.theme.top-geo.button.top)<20,'En-tête sur une ligne : '+theme);
   assert.ok(Math.abs(geo.klass.mid-geo.viewport/2)<90,'Classe bien centrée : '+theme);
   const subtle=await page.evaluate(()=>{
    const bar=document.querySelector('#projection-refresh-progress');
    const wrapper=document.querySelector('.projection-auto-refresh');
    const label=document.querySelector('.projection-auto-label');
    const fill=document.querySelector('#projection-refresh-fill');
    return {barHeight:bar.getBoundingClientRect().height,
     barWidth:bar.getBoundingClientRect().width,
     wrapWidth:wrapper.getBoundingClientRect().width,
     labelSize:getComputedStyle(label).fontSize,
     labelOpacity:getComputedStyle(label).opacity,
     fillBackground:getComputedStyle(fill).backgroundColor};
   });
   assert.equal(subtle.barHeight,4,'Barre fine et discrète : '+theme);
   assert.ok(subtle.wrapWidth<=110&&subtle.barWidth<=110,'Barre compacte : '+theme);
   assert.equal(subtle.labelSize,'9px','Texte secondaire discret : '+theme);
   assert.ok(Number(subtle.labelOpacity)<0.75,'Libellé atténué : '+theme);
   assert.ok(subtle.fillBackground!=='transparent','La progression reste perceptible : '+theme);
   const weight=await page.locator('#header-class').evaluate(el=>getComputedStyle(el).fontWeight);
   assert.ok(Number(weight)>=900,'Titre de classe bien gras : '+theme);
  }
  await page.setViewportSize({width:780,height:780});
  const compact=await page.evaluate(()=>{
   const header=document.querySelector('header').getBoundingClientRect();
   const theme=document.querySelector('#projection-theme').getBoundingClientRect();
   const klass=document.querySelector('#header-class').getBoundingClientRect();
   const button=document.querySelector('#load-real').getBoundingClientRect();
   return {headerHeight:header.height,themeBottom:theme.bottom,classTop:klass.top,buttonTop:button.top,
     scrollWidth:document.documentElement.scrollWidth};
  });
  assert.ok(compact.headerHeight>=70&&compact.classTop>=compact.themeBottom-4,'Repli responsive lisible');
  assert.ok(compact.buttonTop<compact.classTop,'Actualisation reste dans la rangée des commandes');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — barre synchronisée : 20 secondes, clic manuel et pause des réglages',{timeout:65000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL],5);
  await page.clock.install();
  const {errors}=await openBoard(page,url,state);
  const value=()=>page.locator('#projection-refresh-progress').getAttribute('aria-valuenow').then(Number);
  assert.equal(state.loads,1);
  assert.ok(await value()<=5,'Après le chargement, la barre redémarre vide');
  await page.clock.fastForward(10500);
  assert.ok((await value())>=45,'À mi-cycle, la barre est remplie à moitié');
  assert.equal(state.loads,1,'Aucun appel avant 20 secondes');
  await page.locator('#load-real').click();
  await page.waitForFunction(()=>document.querySelector('#projection-refresh-progress').getAttribute('aria-valuenow')==='0');
  assert.equal(state.loads,2,'Clic manuel fait une vraie lecture');
  await page.clock.fastForward(21000);
  await page.waitForFunction(()=>document.querySelector('#projection-refresh-progress').getAttribute('aria-valuenow')==='0');
  assert.ok(state.loads>=3,'À 20 s, une lecture automatique est faite');
  await page.clock.fastForward(7000);
  const atPause=await value();
  await page.locator('#settings-left').click();
  assert.match(await page.locator('#projection-refresh-progress').getAttribute('aria-valuetext'),/suspendue/);
  await page.clock.fastForward(30000);
  assert.equal(await value(),atPause,'La barre conserve son avancement pendant le dialogue');
  const pausedLoads=state.loads;
  await page.locator('#close-settings').click();
  await page.clock.fastForward(3000);
  assert.equal(state.loads,pausedLoads,'La reprise ne provoque pas de MAJ immédiate');
  await page.clock.fastForward(14000);
  // La requête est asynchrone : attendre son retour après le battement simulé.
  await page.waitForFunction(()=>{
   const bar=document.querySelector('#projection-refresh-progress');
   return bar&&!bar.classList.contains('is-paused')
    &&Number(bar.getAttribute('aria-valuenow'))<10;
  },null,{timeout:12000});
  assert.ok(state.loads>pausedLoads,'La MAJ reprend selon le temps restant');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — onglet masqué : zéro MAJ, barre figée et reprise du temps restant',{timeout:65000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL],5);
  await page.clock.install();
  const {errors}=await openBoard(page,url,state);
  const value=()=>page.locator('#projection-refresh-progress').getAttribute('aria-valuenow').then(Number);
  assert.equal(state.loads,1);
  await page.clock.fastForward(8000);
  const beforeHide=await value();
  assert.ok(beforeHide>=30,'La barre a avancé avant masquage');
  await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.match(await page.locator('#projection-refresh-progress').getAttribute('aria-valuetext'),/suspendue/);
  await page.clock.fastForward(90000);
  assert.equal(state.loads,1,'Aucune requête réseau pendant les 90 secondes masquées');
  assert.equal(await value(),beforeHide,'La progression est restée figée');
  await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(state.loads,1,'Le retour visible ne déclenche pas de rattrapage');
  await page.clock.fastForward(9000);
  assert.equal(state.loads,1,'Le temps restant est conservé');
  await page.clock.fastForward(5000);
  await page.waitForFunction(()=>document.querySelector('#projection-refresh-progress')?.getAttribute('aria-valuenow')==='0',
   null,{timeout:12000});
  assert.equal(state.loads,2,'Une seule nouvelle lecture après les secondes restantes');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — prénom en gras dans les exploits, jeu et texte normal, sans surtitre',{timeout:60000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,SUB],5);
  const {errors}=await openBoard(page,url,state);
  await page.waitForFunction(()=>document.querySelectorAll('#exploits .event-student').length>=3);
  assert.deepEqual(await page.locator('#exploits .event-student').allTextContents(),
   ['Élève 1','Élève 2','Élève 3'],'Les noms seuls sont en gras');
  const results=await page.locator('#exploits .event-text').evaluateAll(elements=>elements.map(el=>({
   content:el.textContent,
   initialNodeType:el.firstChild.nodeType,
   nameWeight:getComputedStyle(el.querySelector('strong')).fontWeight,
   name:el.querySelector('strong').textContent,
   remainder:el.querySelector('strong').nextSibling.textContent
  })));
  assert.ok(results[0].content.startsWith('Addition écrite · Élève 1 gagne un nouveau trophée'));
  assert.ok(results[1].content.startsWith('Addition écrite · Élève 2 réussit une série parfaite'));
  assert.ok(results[2].content.startsWith('Soustraction écrite · Élève 3 réalise un score du Top 5'));
  assert.ok(results.every(x=>x.initialNodeType===3),'Le titre du jeu reste en texte normal');
  assert.ok(results.every(x=>Number(x.nameWeight)>=700),'Les noms ressortent en gras');
  assert.ok(results.every(x=>x.remainder.startsWith(' ')),'La phrase après le prénom reste distincte');
  assert.equal(await page.locator('.ranking-card .ranking-head .over').count(),0,'Surtitre supprimé');
  assert.deepEqual(await page.locator('.ranking-card .ranking-head h2').allTextContents(),
   ['Addition écrite','Soustraction écrite']);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});


test('V2 — prénom long, cadre carré, score centré et chiffres en valeur dans les thèmes',{timeout:80000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const state=sampleState([ADD,MUL],5);
  state.longName='Élève au prénom vraiment très long pour vérifier la place du score';
  const {errors}=await openBoard(page,url,state);
  const measure=()=>page.locator(card(ADD)+' .entry.rank-1').evaluate(row=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,midY:r.y+r.height/2}};
   const avatar=row.querySelector('.projection-avatar');
   const name=row.querySelector('.player-label strong');
   const copy=row.querySelector('.entry-copy');
   const score=row.querySelector('.entry-details .points');
   const minor=row.querySelector('.minor');
   const values=[...minor.querySelectorAll('.meta-value')];
   return {
    avatar:rect(avatar),name:rect(name),copy:rect(copy),score:rect(score),row:rect(row),
    weights:values.map(el=>Number(getComputedStyle(el).fontWeight)),
    labelWeight:Number(getComputedStyle(minor.querySelector('.meta-label')).fontWeight),
    numbers:values.map(el=>el.textContent),
    accessible:minor.getAttribute('aria-label'),
    nameOverflow:getComputedStyle(name).textOverflow,
    scoreBackground:getComputedStyle(score).backgroundColor,
    scoreBorder:getComputedStyle(score).borderStyle,
    scorePadding:getComputedStyle(score).paddingLeft,
    scoreRadius:getComputedStyle(score).borderRadius,
    minorGap:getComputedStyle(minor).columnGap,
    trophyMargin:getComputedStyle(minor.querySelector('.meta-trophy')).marginLeft
   };
  });
  for(const theme of ['neon','papier','ardoise','studio']){
   await page.locator('#projection-theme').selectOption(theme);
   const m=await measure();
   assert.equal(m.avatar.width,24,'Cadre compact carré en '+theme);
   assert.equal(m.avatar.height,24,'Hauteur réduite en '+theme);
   assert.ok(Math.abs(m.score.midY-m.copy.midY)<=2,'Points centrés sur nom + niveau en '+theme);
   assert.ok(m.score.left>=m.copy.right+2,'Espace sans chevauchement en '+theme);
   assert.ok(m.score.right<=m.row.right,'Score dans sa case en '+theme);
   assert.notEqual(m.scoreBackground,'rgba(0, 0, 0, 0)','Fond visible derrière les points en '+theme);
   assert.equal(m.scoreBorder,'none','Aucun contour autour des points en '+theme);
   assert.equal(m.scorePadding,'6px','Fond intermédiaire du podium en '+theme);
   assert.equal(m.scoreRadius,'6px','Coins doux du fond des points en '+theme);
   assert.equal(m.minorGap,'2px','Espacement Niv. / chiffre / trophée resserré en '+theme);
   assert.equal(m.trophyMargin,'1px','Trophée rapproché en '+theme);
   assert.ok(m.weights.every(w=>w>=800)&&m.labelWeight<700,'Niv. discret, chiffres gras en '+theme);
   assert.deepEqual(m.numbers,['4','0']);
   assert.equal(m.nameOverflow,'ellipsis');
   assert.match(m.accessible,/Niveau 4, 0 trophées/);
  }
  await page.locator('#settings-left').click();
  await page.getByRole('checkbox',{name:'Soustraction écrite · Afficher score'}).check();
  await page.locator('#close-settings').click();
  await page.waitForFunction(()=>document.querySelector('#projection-main').dataset.appCount==='3');
  const m3=await measure();
  assert.equal(m3.avatar.width,24);
  assert.ok(Math.abs(m3.score.midY-m3.copy.midY)<=2,'En mode 3, score centré');
  assert.ok(m3.score.right<=m3.row.right,'En mode 3, pas de dépassement');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});


test('V2 — cartouches podium intermédiaires, lisibles dans les 4 thèmes',{timeout:80000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),state=sampleState([ADD,MUL],8);
  const {errors}=await openBoard(page,url,state);
  const expected=[
   {background:'rgba(105, 68, 25, 0.36)',color:'rgb(48, 34, 18)',base:[235,187,97],pigment:[105,68,25],ink:[48,34,18]},
   {background:'rgba(43, 80, 106, 0.36)',color:'rgb(27, 46, 61)',base:[187,203,216],pigment:[43,80,106],ink:[27,46,61]},
   {background:'rgba(101, 57, 38, 0.36)',color:'rgb(24, 17, 11)',base:[201,149,118],pigment:[101,57,38],ink:[24,17,11]}
  ];
  const luminance=rgb=>rgb.map(c=>{
   const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
  }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=(one,two)=>{
   const a=luminance(one),b=luminance(two);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  for(const theme of ['neon','papier','ardoise','studio']){
   await page.locator('#projection-theme').selectOption(theme);
   const badges=await page.locator(card(ADD)+' .entry .points').evaluateAll(elements=>elements.slice(0,4).map(el=>{
    const style=getComputedStyle(el),rect=el.getBoundingClientRect(),
     row=el.closest('.entry').getBoundingClientRect();
    return {bg:style.backgroundColor,color:style.color,border:style.borderStyle,
     leftPadding:style.paddingLeft,right:rect.right,rowRight:row.right};
   }));
   assert.equal(badges.length,4,'Quatre lignes observées en '+theme);
   for(let i=0;i<3;i++){
    const e=expected[i],observed=badges[i];
    assert.equal(observed.bg,e.background,'Rang '+(i+1)+' : fond modéré en '+theme);
    assert.equal(observed.color,e.color,'Rang '+(i+1)+' : chiffres foncés en '+theme);
    assert.equal(observed.border,'none','Pas de contour en '+theme);
    assert.equal(observed.leftPadding,'6px','Espacement compact en '+theme);
    const blended=e.base.map((base,j)=>Math.round(base*.64+e.pigment[j]*.36));
    assert.ok(contrast(e.ink,blended)>=4.5,'Texte suffisamment lisible au rang '+(i+1)+' en '+theme);
    assert.ok(observed.right<=observed.rowRight,'Pas de débordement du score en '+theme);
   }
   assert.ok(!expected.some(e=>e.background===badges[3].bg),
    'La quatrième place conserve son cartouche discret en '+theme);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('V2 — ex aequo : 9 ors, 2 argents, 2 bronzes et rangs identiques entre colonnes',{timeout:80000},async()=>{
 const {server,url}=await serve(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const state=sampleState([ADD,MUL],16);
  state.tieScores=[...Array(9).fill(220),200,200,180,180,160,140,120];
  const {errors}=await openBoard(page,url,state);
  const ranks=async()=>page.locator(card(ADD)+' .entry').evaluateAll(rows=>rows.map(el=>({
   rank:el.querySelector('.place')?.textContent,
   score:el.querySelector('.points')?.textContent,
   className:el.className
  })));
  const expected=[...Array(9).fill('1'),...Array(2).fill('2'),...Array(2).fill('3'),'4','5','6'];
  const checkRanks=async label=>{
   const entries=await ranks();
   assert.deepEqual(entries.map(e=>e.rank),expected,label+' : tous les scores identiques partagent le rang');
   for(let i=0;i<entries.length;i++){
    assert.ok(entries[i].className.split(' ').includes('rank-'+expected[i]),
     label+' : couleur du rang '+expected[i]+' identique pour tous les ex aequo');
   }
   assert.deepEqual(entries.slice(0,9).map(e=>e.score),Array(9).fill('220 pts'));
  };
  await checkRanks('Deux jeux affichés');
  assert.equal(await page.locator(card(ADD)+' .ranking-col').count(),2,'Deux colonnes dans le jeu');
  assert.equal(await page.locator(card(ADD)+' .ranking-col').first().locator('.entry.rank-1').count(),8,
   'Huit cases or dans la première colonne');
  assert.equal(await page.locator(card(ADD)+' .ranking-col').last().locator('.entry.rank-1').count(),1,
   'Une neuvième case or dans la deuxième colonne');
  assert.equal(await page.locator(card(MUL)+' .entry.rank-1').count(),1,
   'Les égalités de l’addition ne changent pas la multiplication');
  await page.locator('#settings-left').click();
  await page.getByRole('checkbox',{name:'Soustraction écrite · Afficher score'}).check();
  await page.locator('#close-settings').click();
  await page.waitForFunction(()=>document.querySelector('#projection-main').dataset.appCount==='3');
  await checkRanks('Trois jeux affichés');
  assert.equal(await page.locator(card(ADD)+' .ranking-col').count(),1,
   'Trois jeux : une seule colonne par jeu');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
