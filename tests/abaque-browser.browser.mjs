import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {modal,inputConversion,enterMaster,solveConstruction,solveMoves} from './helpers/abaque-browser-driver.mjs';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const key='mathas_connect_abaque_demo_progress_v1';
const trophyKey='mathas_connect_abaque_demo_trophies_v1';
const labClass='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';

async function setup(mockExternal){
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html');
  const target=resolve(root,'.'+pathname);
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
   const bytes=await readFile(target);
   res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.webp':'image/webp'})[extname(target)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),headless:true,args:['--no-sandbox']});
 }catch(error){await new Promise(done=>server.close(done));throw error;}
 const page=await browser.newPage();
 page.setDefaultTimeout(12000);
 const errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',async route=>{
  if(route.request().url().startsWith(origin+'/'))return route.continue();
  if(mockExternal&&await mockExternal(route))return;
  external.push(route.request().url());
  await route.abort();
 });
 return {page,origin,url:origin+'/apps/GRAN-abaque-m-1/',errors,external,
  close:async()=>{await browser.close();await new Promise(done=>server.close(done));}};
}
const progress=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const trophies=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),trophyKey);

// Fixtures supply unlocks, never perfect results: gold must come from actual play.
async function fixture(page,state={}){
 const saved={stage1:{passes:['orange','orange'],passScores:[10,10]},
  stage2:{passes:['orange','orange'],passScores:[7,7]},
  modes:{one:'orange',three:'orange',five:'orange'},...state};
 await page.evaluate(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key,saved});
 await page.reload();
}
test('Abaque : premiers essais 10/12 et 7/8, déblocages, puis trophées parfaits après les deux réussites',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  assert.equal(await page.locator('.trophy-hint').count(),6);
  assert.equal(await page.locator('.trophy-hint.earned').count(),0);
  assert.equal(await page.locator('#personalBest').textContent(),'0');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'0 / 6');
  assert.deepEqual(await page.locator('.trophy-hint').allTextContents(),Array(6).fill(''));
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'true');
  for(let run=0;run<2;run++)await solveConstruction(page,{imperfect:true});
  assert.deepEqual((await progress(page)).stage1.passScores,[10,10]);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'false');
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'false');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');
  for(let run=0;run<2;run++)await solveMoves(page,{imperfect:true});
  assert.deepEqual((await progress(page)).stage2.passScores,[7,7]);
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'false');
  await solveMoves(page);
  assert.equal(await page.locator('[data-mode="one"]').getAttribute('aria-disabled'),'false');
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'true');
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'false');
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.trophy-hint.earned').count(),2,'acquis démo conservés après reset/rechargement');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'2 / 6');
  assert.equal(await page.locator('.collection-trophy.earned').count(),2);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : or seulement après les trois vraies séries parfaites, scores natifs et placement mobile',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  for(const [mode,pages,max] of [['one',1,100],['three',3,324],['five',5,580]]){
   await page.locator(`[data-mode="${mode}"]`).click();
   for(let n=0;n<pages;n++){await inputConversion(page);await modal(page,n+1===pages?'Accueil':'Page suivante');}
   assert.equal((await progress(page)).recordsByMode[mode],max);
   assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),String(mode==='five'));
   assert.equal(await page.locator('#personalBest').textContent(),String(max));
  }
  for(const width of [320,768,1024]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
   const bounds=await page.locator('.homeCard>.trophy-hint').evaluateAll(els=>els.map(el=>{
    const badge=el.getBoundingClientRect(),card=el.closest('.homeCard').getBoundingClientRect();
    return badge.left>=card.left&&badge.right<=card.right&&badge.bottom<=card.bottom&&card.bottom-badge.bottom<22&&card.right-badge.right<22;
   }));
   assert.deepEqual(bounds,[true,true,true],'trophées en bas à droite à '+width+' px');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:resolve(tmpdir(),'abaque-desktop.png'),fullPage:true});
  await page.setViewportSize({width:320,height:900});
  await page.screenshot({path:resolve(tmpdir(),'abaque-mobile.png'),fullPage:true});
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mathas_abaque_longueurs_progress_v1')),null);
 }finally{await h.close();}
});

test('Abaque : 3 vies, réponse incomplète, doublon, cœur perdu permanent ; Mort subite sans double bonus',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-variant="lives"]').click();
  await page.locator('#t3Verify').click();
  assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),'3 vies restantes');
  // Five successes cross the native four-question step, without a second +20%.
  for(let success=0;success<5;success++){
   await inputConversion(page);
   assert.equal(await page.locator('#t3ScoreNow').textContent(),(success<4?25*(success+1):129)+' points');
   await modal(page,'Suivante');
  }
  assert.equal(await page.locator('.t3Open').isDisabled(),true,'manipulation verrouillée dès la quatrième réussite');
  for(let remaining=2;remaining>=0;remaining--){
   await inputConversion(page,true);
   await page.evaluate(()=>document.querySelector('#t3Verify').click());
   assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),remaining+' vies restantes');
   assert.equal(await page.locator('.t3retry').count(),0);
   await modal(page,remaining?'Suivante':'Accueil');
   if(remaining===2){
    await page.locator('.heart-lost').evaluate(el=>{el.dataset.retainedHeart='yes';});
    await inputConversion(page);
    assert.equal(await page.locator('[data-retained-heart="yes"]').count(),1,'le cœur déjà brisé garde son élément');
    assert.equal(await page.locator('.heart-breaking').count(),0,'aucune nouvelle animation de perte sur bonne réponse');
    await modal(page,'Suivante');
   }
  }
  assert.deepEqual(await trophies(page),[],'3 vies ne rapporte aucun trophée');
  assert.deepEqual((await progress(page)).scoreRecords.medals,[],'3 vies ne rapporte aucune médaille locale');
  await page.locator('[data-variant="sudden"]').click();
  for(let success=0;success<5;success++){
   await inputConversion(page);
   assert.equal(await page.locator('#t3ScoreNow').textContent(),(success<4?30*(success+1):155)+' points');
   await modal(page,'Suivante');
   if(success===0)assert.equal(await page.locator('.t3UnitsBtn').isDisabled(),true);
  }
  await inputConversion(page,true);await modal(page,'Accueil');
  assert.equal((await progress(page)).suddenBest,5);
  assert.match(await page.locator('[data-variant="sudden"] .modeResult').textContent(),/5 de suite/);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('Abaque : Master au départ ou pendant une partie exclut résultats et trophées même après sortie',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await enterMaster(page);await page.locator('#launchBtn').click();await page.locator('#masterExit').click();
  await solveConstruction(page,{started:true});
  assert.deepEqual(await trophies(page),[],'une construction commencée en Master ne gagne pas de bronze');
  assert.equal((await progress(page)).stage1.passes.length,0);
  await fixture(page);
  await enterMaster(page);await page.locator('#moveLaunchBtn').click();await page.locator('#masterExit').click();
  await solveMoves(page,{started:true});
  assert.deepEqual(await trophies(page),[],'déplacements commencés en Master : aucun argent');
  for(const masterAtStart of [true,false]){
   if(masterAtStart)await enterMaster(page);
   await page.locator('[data-mode="one"]').click();
   if(!masterAtStart)await enterMaster(page);
   await page.locator('#masterExit').click();
   await inputConversion(page);await modal(page,'Accueil');
   assert.deepEqual((await progress(page)).recordsByMode,{},'Master exclut les scores pour toute la partie');
   assert.deepEqual(await trophies(page),[]);
  }
  await page.locator('[data-mode="one"]').click();await inputConversion(page);await modal(page,'Accueil');
  assert.equal((await progress(page)).recordsByMode.one,100,'la prochaine partie ordinaire compte normalement');
  await enterMaster(page);await page.locator('[data-variant="sudden"]').click();await page.locator('#masterExit').click();
  for(let n=0;n<3;n++){await inputConversion(page);await modal(page,n===2?'Accueil':'Suivante');}
  assert.deepEqual(await trophies(page),[],'trois pages commencées en Master ne donnent pas de coupe Mort subite');
  assert.equal((await progress(page)).suddenBest,0,'la série Master ne devient pas un record');

  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : correction au deuxième essai et aides conservent les points natifs',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page,{modes:{}});
  await page.locator('[data-mode="one"]').click();
  await inputConversion(page,i=>i===0,{expectModal:false});
  assert.equal(await page.locator('.t3retry').count(),1);
  await inputConversion(page);await modal(page,'Accueil');
  assert.equal((await progress(page)).modeScores.one,3,'3 bonnes réponses au premier essai, pas 4');
  assert.equal((await progress(page)).recordsByMode.one,81,'3×25 + 6 points de correction');
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'true');
  for(const [withUnits,expected] of [[false,95],[true,90]]){
   await page.locator('[data-mode="one"]').click();
   const first=page.locator('.t3Ex').first();
   await first.locator('.t3Open').click();
   if(withUnits)await first.locator('.t3UnitsBtn').click();
   await inputConversion(page);
   assert.equal(await page.locator('#t3ScoreNow').textContent(),expected+' points');
   await modal(page,'Accueil');
  }
  assert.deepEqual(await trophies(page),[]);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : carte expérimentale dans le HUB TEST seulement, avec catalogues entièrement fictifs',async()=>{
 let calls=0;
 const h=await setup(async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='fonts.googleapis.com'){
   await route.fulfill({status:200,contentType:'text/css',body:'/* Polices système pour le test isolé du HUB. */'});return true;
  }
  if(url.hostname==='awmhpfofacaglewammxt.supabase.co'&&['/functions/v1/connect-lab-catalog','/functions/v1/connect-catalog'].includes(url.pathname)){
   calls++;await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,apps:[]})});return true;
  }
  return false;
 });
 const {page}=h;
 try{
  await page.addInitScript(()=>localStorage.setItem('mathas.connect.mode-libre.v1','1'));
  await page.goto(h.origin+'/hub.html?class='+labClass);
  const preview=page.locator('[data-lab-preview="abaque-longueurs"]');
  await preview.waitFor();assert.equal(await preview.getAttribute('href'),'https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/');
  for(const [space,classId] of [['observation','8fe170fa-9e8f-4e80-885a-b0ba68026f64'],['phase1','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e'],['phase2','1b021ed9-4846-4203-9c7b-4b5fa8d7adab'],['phase2b','0d8ba828-59cc-468b-a4b8-7b2a1af10b88'],['2eco','a9195199-0a28-4e86-99ce-47b36dd6e646']]){
   // The teacher portal supplies both class and space, including Phase 2 B.
   await page.goto(h.origin+'/hub.html?class='+classId+'&space='+space);
   await page.locator('#levels .level-title').first().waitFor();
   assert.equal(await page.locator('[data-lab-preview="abaque-longueurs"]').count(),0,space);
  }
  assert.equal(calls,6);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});


test('Abaque : les anciennes réussites de la même démo réaffichent les trophées sans import natif',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await fixture(page,{
   stage1:{passes:['green','orange'],passScores:[12,10]},
   stage2:{passes:['orange','green'],passScores:[7,8]},
   modes:{one:'green',three:'green',five:'green'}
  });
  assert.deepEqual((await trophies(page)).sort(),['bronze','gold','silver']);
  assert.equal(await page.locator('.homeCard>.trophy-hint.earned').count(),3);
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.homeCard>.trophy-hint.earned').count(),3);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mathas_abaque_longueurs_progress_v1')),null);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque démo : trois états de compte simulés, XP discrets et zéro modification des acquis locaux',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await page.evaluate(({key,trophyKey})=>{
   const saved=JSON.parse(localStorage.getItem(key));
   saved.scoreRecords.allBest=129;saved.scoreRecords.allMode='lives';saved.recordsByMode.lives=129;
   localStorage.setItem(key,JSON.stringify(saved));localStorage.setItem(trophyKey,'["silver"]');
  },{key,trophyKey});
  await page.reload();
  const initial=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const choice=page.locator('#abaque-demo-state');
  assert.equal(await choice.inputValue(),'signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.equal(await page.locator('#personalBest').textContent(),'129');
  await choice.selectOption('connected');
  assert.equal(await page.locator('.abaque-demo-xp:visible').count(),7);
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').textContent(),'Reste 6 XP');
  assert.equal(await page.locator('[data-variant="sudden"]>.abaque-xp-remaining').textContent(),'Reste 32 XP');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'0 / 6');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').evaluate(el=>getComputedStyle(el).fontWeight),'400');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true','une activité reste jouable dans le profil fictif');
  await choice.selectOption('collected');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'6 / 6');
  assert.equal(await page.locator('#personalBest').textContent(),'580');
  assert.equal(await page.locator('.collection-trophy.earned').count(),6);
  assert.deepEqual(await page.locator('.abaque-demo-xp').allTextContents(),Array(7).fill('Reste 0 XP'));
  assert.equal(await page.locator('#recordChoice .record-caption .abaque-xp-remaining').count(),0);
  assert.deepEqual(await page.locator('.trophy-hint').allTextContents(),Array(6).fill(''));
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('title'),'Architecte de l’abaque — obtenu');
  for(const width of [1440,768,320]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'simulation sans débordement à '+width);
   assert.equal(await page.locator('[data-variant="sudden"]').evaluate(button=>{
    const card=button.getBoundingClientRect(),cups=button.querySelector('.record-trophies').getBoundingClientRect();
    const caption=button.querySelector('.record-caption').getBoundingClientRect(),xp=button.querySelector('.abaque-xp-remaining').getBoundingClientRect();
    return cups.right<=card.right&&cups.bottom<=card.bottom&&card.right-cups.right<17&&card.bottom-cups.bottom<17&&caption.bottom<cups.top&&xp.right<cups.left;
   }),true,'coupes et XP séparés, hors du cadre intérieur à '+width);
   assert.equal(await page.locator('#recordChoice').evaluate(el=>el.getBoundingClientRect().top>document.querySelector('#convertLaunchCard').getBoundingClientRect().bottom),true);

  }
  await page.screenshot({path:resolve(tmpdir(),'abaque-demo-scenarios-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:resolve(tmpdir(),'abaque-demo-scenarios-desktop.png'),fullPage:true});
  await choice.selectOption('signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.equal(await page.locator('#personalBest').textContent(),'129');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'1 / 6');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),initial,'aucun faux résultat, XP ou trophée enregistré');
  await choice.selectOption('collected');await page.reload();
  assert.equal(await choice.inputValue(),'signed-out','pas de fausse connexion conservée au rechargement');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});


test('Abaque : les deux modes record exigent 80 % dans chacun des trois formats, résultats sans libellé',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  for(const scores of [{one:3,three:10,five:16},{one:4,three:9,five:16},{one:4,three:10,five:15}]){
   await fixture(page,{modeScores:scores});
   assert.equal(await page.locator('#recordChoice').isVisible(),true);
   for(const variant of ['lives','sudden']){
    const button=page.locator('[data-variant="'+variant+'"]');
    assert.equal(await button.getAttribute('aria-disabled'),'true');
    await button.click({force:true});assert.equal(await page.locator('#homeScreen').isVisible(),true);
   }
  }
  await fixture(page,{modeScores:{one:4,three:10,five:16}});
  for(const variant of ['lives','sudden'])assert.equal(await page.locator('[data-variant="'+variant+'"]').getAttribute('aria-disabled'),'false');
  for(const [mode,result] of [['one','4/4'],['three','10/12'],['five','16/20']])assert.equal(await page.locator('[data-mode="'+mode+'"] .modeResult').textContent(),result);
  assert.equal(await page.locator('#recordLock').isVisible(),false);
  assert.equal(await page.locator('.scoreMedals,.scoreMedal').count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : coupes Mort subite aux pages 3, 5 et 8 seulement, ni cumul ni 3 vies ni or classique',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-variant="lives"]').click();
  for(let n=0;n<8;n++){await inputConversion(page);await modal(page,'Suivante');}
  for(let n=0;n<3;n++){await inputConversion(page,true);await modal(page,n===2?'Accueil':'Suivante');}
  assert.deepEqual(await trophies(page),[],'huit pages en 3 vies ne donnent aucune coupe');
  await page.locator('[data-variant="sudden"]').click();
  for(let n=0;n<2;n++){await inputConversion(page);await modal(page,'Suivante');}
  await inputConversion(page,true);await modal(page,'Accueil');
  assert.deepEqual(await trophies(page),[]);
  await page.locator('[data-variant="sudden"]').click();
  for(let pages=1;pages<=8;pages++){
   await inputConversion(page);
   const expected=[...(pages>=3?['sudden-bronze']:[]),...(pages>=5?['sudden-silver']:[]),...(pages>=8?['sudden-gold']:[])];
   assert.deepEqual(await trophies(page),expected,'seuil exact à '+pages+' pages consécutives');
   await modal(page,pages===8?'Accueil':'Suivante');
  }
  await page.reload();
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'3 / 6');
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'false','l’or classique est indépendant');
  assert.equal(await page.locator('.record-trophies .earned').count(),3);
  assert.equal((await progress(page)).suddenBest,8);
  assert.deepEqual((await progress(page)).scoreRecords.medals,[],'aucune médaille de score');
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.record-trophies .earned').count(),3,'coupes conservées après reset');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});


test('GRAN : ancienne adresse conservée, paramètres et acquis de la démo préservés',async()=>{
 // This scenario checks URL forwarding; real Auth is exercised by the local service suite.
 const h=await setup(async route=>{
  if(route.request().url()==='https://esm.sh/@supabase/supabase-js@2.95.0'){await route.abort();return true;}
  return false;
 }),{page}=h;
 try{
  await page.goto(h.url);
  await page.evaluate(k=>{const state=JSON.parse(localStorage.getItem(k));state.scoreRecords.allBest=129;state.scoreRecords.allMode='lives';localStorage.setItem(k,JSON.stringify(state));},key);
  await page.goto(h.origin+'/apps/abaque-longueurs/?demo=1#accueil');
  await page.waitForURL(url=>url.pathname==='/apps/GRAN-abaque-m-1/'&&url.search==='?demo=1'&&url.hash==='#accueil');
  assert.equal(await page.locator('#personalBest').textContent(),'129');
  assert.equal(await page.locator('#abaque-demo-state').inputValue(),'signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  await page.goto(h.origin+'/apps/abaque-longueurs/?connect=1&class='+labClass+'#retour');
  await page.waitForURL(url=>url.pathname==='/apps/GRAN-abaque-m-1/'&&url.searchParams.get('connect')==='1'&&url.searchParams.get('class')===labClass&&url.hash==='#retour');
  assert.equal(await page.locator('#abaque-demo-state').count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Laboratoire : carte Abaque en ligne, attente serveur puis autorisation fictive, avec Auth et transports simulés',async()=>{
 // Full portal UI coverage only. Real Auth/Edge are covered by abaque-auth-local.e2e.mjs.
 const pupil='10000000-0000-4000-8000-000000000001';
 const archived='10000000-0000-4000-8000-000000000002';
 let catalogue='missing',serverReady=false;
 const approvals=[],visibility=[];
 const h=await setup(async route=>{
  const url=new URL(route.request().url());
  if(url.href==='https://esm.sh/@supabase/supabase-js@2.95.0'){
   const body=`export function createClient(base,key,options={}){return {auth:{getSession:async()=>({data:{session:options.auth?.storageKey==='mathas-connect-professor-auth-v1'?{access_token:'test-teacher-token',user:{id:'10000000-0000-4000-8000-000000000010',is_anonymous:false}}:null},error:null})}}}`;
   await route.fulfill({status:200,contentType:'text/javascript',body});return true;
  }
  if(url.hostname!=='awmhpfofacaglewammxt.supabase.co')return false;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return true;}
  const body=route.request().postDataJSON();let data={ok:true};
  if(url.pathname.endsWith('/connect-api')){
   if(body.action==='teacher-dashboard')data={ok:true,classes:[{id:labClass,name:'Classe démo - TEST'}],students:[{id:pupil,display_name:'Fictif laboratoire'},{id:archived,display_name:'Fictif archivé',archived_at:'2026-01-01'}],requests:[],devices:[]};
   else if(body.action==='teacher-player')data={ok:true,status:'approved',displayName:'Monsieur T'};
   else assert.fail('Unexpected Connect API action: '+body.action);
  }else if(url.pathname.endsWith('/connect-lab-catalog')){
   if(body.action==='list')data={ok:true,apps:catalogue==='missing'?[]:[{app_key:'abaque-longueurs',title:'Abaque des longueurs',enabled:catalogue==='enabled',visible:false,launch_url:'./apps/GRAN-abaque-m-1/?demo=1'}]};
   else{visibility.push(body);data={ok:true,visible:body.visible};}
  }else if(url.pathname.endsWith('/connect-abaque')){
   if(body.action==='teacher-pilot-status')data={ok:true,ready:serverReady};
   else if(body.action==='teacher-pilot-approve'){approvals.push(body);data={ok:true,approvedCount:2};}
   else assert.fail('Unexpected Abaque action: '+body.action);
  }else if(url.pathname.endsWith('/connect-results'))data={ok:true,students:[],locks:[]};
  else return false;
  await route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(data)});return true;
 }),{page}=h;
 try{
  await page.goto(h.origin+'/laboratoire.html');
  const card=page.locator('#apps [data-online-app="abaque-longueurs"]');
  await card.waitFor();
  assert.equal(await page.locator('#apps-title').textContent(),'Tests en ligne');
  assert.match(await card.locator('[data-abaque-pilot-status]').textContent(),/Activation Connect en attente/);
  const link=card.getByRole('link',{name:'Tester côté élève'});
  const href=new URL(await link.getAttribute('href'));
  assert.equal(href.pathname,'/apps/GRAN-abaque-m-1/');assert.equal(href.searchParams.get('connect'),'1');
  assert.equal(href.searchParams.get('class'),labClass);assert.equal(href.searchParams.has('demo'),false);
  assert.equal(await link.getAttribute('aria-disabled'),'true');
  assert.equal(await card.getByRole('link',{name:'Résultats Abaque'}).getAttribute('aria-disabled'),'true');
  await page.locator('#teacher-mode').click();
  await page.waitForFunction(()=>document.querySelector('#teacher-status').textContent.includes('approuvé'));
  assert.equal(await card.getByRole('button',{name:'Monsieur T',exact:true}).isDisabled(),true,'l’activation commune ne doit pas débloquer un backend absent');
  catalogue='disabled';await card.getByRole('button',{name:'Vérifier la connexion'}).click();
  await page.waitForFunction(()=>document.querySelector('#apps [data-online-app="abaque-longueurs"]').textContent.includes('Application désactivée côté serveur'));
  assert.equal(await card.locator('[data-abaque-pilot-approve]').isDisabled(),true);
  catalogue='enabled';await card.getByRole('button',{name:'Vérifier la connexion'}).click();
  await page.waitForFunction(()=>!document.querySelector('#apps [data-online-app="abaque-longueurs"]').textContent.includes('Application désactivée côté serveur'));
  assert.equal(await link.getAttribute('aria-disabled'),'true','catalogue activé mais pilote fermé');
  serverReady=true;await card.getByRole('button',{name:'Vérifier la connexion'}).click();
  await page.waitForFunction(()=>document.querySelector('#apps [data-online-app="abaque-longueurs"] a').getAttribute('aria-disabled')==='false');
  assert.equal(await card.locator('[data-abaque-pilot-approve]').isDisabled(),true,'pas d’autorisation sans confirmation fictive');
  assert.equal(await card.getByRole('button',{name:'Monsieur T',exact:true}).isDisabled(),false);
  await page.locator('#fictive-confirm').check();
  await card.locator('[data-abaque-pilot-approve]').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('2 profil(s) fictif(s) autorisé(s)'));
  assert.deepEqual(approvals,[{action:'teacher-pilot-approve',appKey:'abaque-longueurs',classId:labClass,fictiveConfirmed:true,studentIds:[pupil],includeTeacher:true}]);
  assert.deepEqual(visibility,[],'ni activation ni publication HUB pendant une autorisation de profils');
  const demo=page.locator('#record-previews a[href*="GRAN-abaque-m-1"]');
  assert.equal(await demo.count(),1,'la démo reste dans la rubrique hors ligne');
  assert.equal(new URL(await demo.getAttribute('href'),h.origin).searchParams.has('connect'),false);
  await page.locator('#fictive-confirm').uncheck();
  assert.equal(await card.locator('[data-abaque-pilot-approve]').isDisabled(),true);
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(tmpdir(),'abaque-laboratoire-online-mobile.png'),fullPage:true});
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});
