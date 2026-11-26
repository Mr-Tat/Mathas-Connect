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
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'false','une seule série parfaite ne suffit pas');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');
  for(let run=0;run<2;run++)await solveMoves(page,{imperfect:true});
  assert.deepEqual((await progress(page)).stage2.passScores,[7,7]);
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'false');
  await solveMoves(page);
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'false','une seule série parfaite ne suffit pas');
  await solveMoves(page);
  assert.equal(await page.locator('[data-mode="one"]').getAttribute('aria-disabled'),'false');
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'true');
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'false');
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.trophy-hint.earned').count(),2,'acquis démo conservés après reset/rechargement');
  assert.deepEqual((await progress(page)).stage1.passes,[]);
  assert.deepEqual((await progress(page)).stage2.passes,[]);
  assert.equal((await progress(page)).stage1.perfectRuns,0);
  assert.equal((await progress(page)).stage2.perfectRuns,0);
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'true','le trophée permanent ne débloque pas le nouveau parcours');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'2 / 6');
  assert.equal(await page.locator('.collection-trophy.earned').count(),2);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : or seulement après les trois vraies séries parfaites, scores natifs et placement mobile',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  for(const [mode,pages,max] of [['one',1,12],['three',3,36],['five',5,60]]){
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

test('Abaque : 3 vies, réponse incomplète, cœur perdu permanent ; Mort subite ×2',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-variant="lives"]').click();
  await page.locator('#t3Verify').click();
  assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),'3 vies restantes');
  for(let i=1;i<=5;i++){
   await inputConversion(page,false,{expectModal:i===5});
   assert.equal(await page.locator('#t3ScoreNow').textContent(),3*i+' points');
   if(i===5)await modal(page,'Page suivante');
  }
  assert.equal(await page.locator('.t3Ex:not(:has(input:disabled)) .t3Open').isDisabled(),true,'manipulation verrouillée après 3 réussites');
  await inputConversion(page,true,{expectModal:false});
  assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),'2 vies restantes');
  assert.equal(await page.locator('.t3retry').count(),0);
  await page.locator('.heart-lost').evaluate(el=>{el.dataset.retainedHeart='yes'});
  await inputConversion(page,false,{expectModal:false});
  assert.equal(await page.locator('[data-retained-heart="yes"]').count(),1);
  assert.equal(await page.locator('.heart-breaking').count(),0);
  await inputConversion(page,true,{expectModal:false});
  assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),'1 vies restantes');
  await inputConversion(page,true,{expectModal:true});
  assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),'0 vies restantes');
  await modal(page,'Accueil');
  assert.deepEqual(await trophies(page),[]);
  assert.deepEqual((await progress(page)).scoreRecords.medals,[]);
  await page.locator('[data-variant="sudden"]').click();
  for(let i=1;i<=5;i++){
   await inputConversion(page,false,{expectModal:i===5});
   assert.equal(await page.locator('#t3ScoreNow').textContent(),6*i+' points');
   if(i===1)assert.equal(await page.locator('.t3Ex:not(:has(input:disabled)) .t3UnitsBtn').isDisabled(),true);
   if(i===5)await modal(page,'Page suivante');
  }
  await inputConversion(page,true);await modal(page,'Accueil');
  assert.equal((await progress(page)).suddenBest,5);
  assert.match(await page.locator('[data-variant="sudden"] .modeResult').textContent(),/30 pts/);
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
  assert.equal((await progress(page)).recordsByMode.one,12,'la prochaine partie ordinaire compte normalement');
  await enterMaster(page);await page.locator('[data-variant="sudden"]').click();await page.locator('#masterExit').click();
  for(let n=1;n<=15;n++){await inputConversion(page,false,{expectModal:n%5===0});if(n%5===0)await modal(page,n===15?'Accueil':'Page suivante');}
  assert.deepEqual(await trophies(page),[],'quinze conversions commencées en Master ne donnent pas de coupe Mort subite');
  assert.equal((await progress(page)).suddenBest,0,'la série Master ne devient pas un record');

  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : record personnel spectaculaire, sans seconde fenêtre et sans répéter au score égal',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page,{modes:{one:'red'},modeScores:{one:2}});
  await page.locator('[data-mode="one"]').click();
  await inputConversion(page,i=>i===0,{expectModal:false});
  await inputConversion(page);
  const celebration=page.locator('#celebrateDialog .abaque-personal-recap');
  await celebration.waitFor();
  assert.match(await celebration.innerText(),/Nouveau record personnel/);
  assert.match(await celebration.innerText(),/2 \/ 4 → 3 \/ 4/);
  assert.equal(await page.locator('#celebrateDialog').count(),1,'aucune nouvelle fenêtre modale');
  await modal(page,'Accueil');
  await page.locator('[data-mode="one"]').click();await inputConversion(page);
  assert.match(await celebration.innerText(),/3 \/ 4 → 4 \/ 4/);
  await modal(page,'Accueil');
  await page.locator('[data-mode="one"]').click();await inputConversion(page);
  assert.equal(await celebration.count(),0,'résultat identique : aucune nouvelle célébration');
  await modal(page,'Accueil');
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
  assert.equal((await progress(page)).recordsByMode.one,9,'3×3 + 0 point de correction');
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'false','3/4 suffit pour passer à 3 pages');
  for(const [withUnits,expected] of [[false,12],[true,12]]){
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
   calls++;
   const apps=url.pathname.endsWith('/connect-lab-catalog')?[{app_key:'abaque-longueurs',title:'Abaque des longueurs',launch_url:'./apps/GRAN-abaque-m-1/?connect=1',hub_section:'outil',display_order:70,enabled:true,featured:false,visible:true}]:[];
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,apps})});return true;
  }
  return false;
 });
 const {page}=h;
 try{
  await page.addInitScript(()=>localStorage.setItem('mathas.connect.mode-libre.v1','1'));
  await page.goto(h.origin+'/hub.html?class='+labClass);
  const preview=page.locator('.app-card[data-app-key="abaque-longueurs"]');
  await preview.waitFor();
  const labLink=new URL(await preview.getAttribute('href'));
  assert.equal(labLink.pathname,'/apps/GRAN-abaque-m-1/');
  assert.equal(labLink.searchParams.get('connect'),'1');
  assert.equal(labLink.searchParams.get('class'),labClass);
  for(const [space,classId] of [['observation','8fe170fa-9e8f-4e80-885a-b0ba68026f64'],['phase1','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e'],['phase2','1b021ed9-4846-4203-9c7b-4b5fa8d7adab'],['phase2b','0d8ba828-59cc-468b-a4b8-7b2a1af10b88'],['2eco','a9195199-0a28-4e86-99ce-47b36dd6e646']]){
   // The teacher portal supplies both class and space, including Phase 2 B.
   await page.goto(h.origin+'/hub.html?class='+classId+'&space='+space);
   await page.locator('#levels .level-title').first().waitFor();
   assert.equal(await page.locator('.app-card[data-app-key="abaque-longueurs"]').count(),0,space);
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
  // Anciennes coupes bronze/argent insuffisamment prouvées : ne pas les réattribuer.
  // L'or local déjà acquis demeure ; les nouvelles coupes nécessitent 2 séries parfaites.
  await page.evaluate(key=>localStorage.setItem(key,'["bronze","silver","gold"]'),trophyKey);
  await page.reload();
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'false');
  assert.equal(await page.locator('#trophy-moveLaunchBtn').getAttribute('data-earned'),'false');
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'true');
  assert.equal(await page.locator('.homeCard>.trophy-hint.earned').count(),1);
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.homeCard>.trophy-hint.earned').count(),1);
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
   saved.scoreRecords.allBest=129;saved.scoreRecords.allMode='lives';saved.recordsByMode.lives=129;saved.stage2.perfectRuns=2;
   localStorage.setItem(key,JSON.stringify(saved));localStorage.setItem(trophyKey,'["silver"]');
  },{key,trophyKey});
  await page.reload();
  const initial=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const choice=page.locator('#abaque-demo-state');
  assert.equal(await choice.inputValue(),'signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.equal(await page.locator('#scoreHistory').textContent(),'129 pts');
  await choice.selectOption('connected');
  assert.equal(await page.locator('.abaque-demo-xp:visible').count(),7);
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').textContent(),'Reste 6 XP');
  assert.equal(await page.locator('[data-variant="sudden"]>.abaque-xp-remaining').textContent(),'Reste 32 XP');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'0 / 6');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').evaluate(el=>getComputedStyle(el).fontWeight),'400');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'false','une seule série parfaite ne suffit pas même dans la simulation');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true','une activité reste jouable dans le profil fictif');
  await choice.selectOption('collected');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'6 / 6');
  assert.equal(await page.locator('#scoreHistory').textContent(),'580 pts');
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
  assert.equal(await page.locator('#scoreHistory').textContent(),'129 pts');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'1 / 6');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),initial,'aucun faux résultat, XP ou trophée enregistré');
  await choice.selectOption('collected');await page.reload();
  assert.equal(await choice.inputValue(),'signed-out','pas de fausse connexion conservée au rechargement');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});


test('Abaque : les deux modes record exigent 75 % dans chacun des trois formats, résultats sans libellé',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  for(const scores of [{one:2,three:9,five:15},{one:3,three:8,five:15},{one:3,three:9,five:14}]){
   await fixture(page,{modeScores:scores});
   assert.equal(await page.locator('#recordChoice').isVisible(),true);
   for(const variant of ['lives','sudden']){
    const button=page.locator('[data-variant="'+variant+'"]');
    assert.equal(await button.getAttribute('aria-disabled'),'true');
    await button.click({force:true});assert.equal(await page.locator('#homeScreen').isVisible(),true);
   }
  }
  await fixture(page,{modeScores:{one:3,three:9,five:15}});
  for(const variant of ['lives','sudden'])assert.equal(await page.locator('[data-variant="'+variant+'"]').getAttribute('aria-disabled'),'false');
  for(const [mode,result] of [['one','3/4'],['three','9/12'],['five','15/20']])assert.equal(await page.locator('[data-mode="'+mode+'"] .modeResult').textContent(),result);
  assert.equal(await page.locator('#recordLock').isVisible(),false);
  assert.equal(await page.locator('.scoreMedals,.scoreMedal').count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : coupes Mort subite à 15, 25 et 40 conversions sans aide, ni cumul ni 3 vies',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-variant="lives"]').click();
  for(let n=1;n<=40;n++){await inputConversion(page,false,{expectModal:n%5===0});if(n%5===0)await modal(page,'Page suivante')}
  for(let n=1;n<=3;n++){await inputConversion(page,true,{expectModal:n===3});if(n===3)await modal(page,'Accueil')}
  assert.deepEqual(await trophies(page),[],'40 bonnes conversions en 3 vies ne donnent aucune coupe');
  await page.locator('[data-variant="sudden"]').click();
  for(let n=1;n<=14;n++){await inputConversion(page,false,{expectModal:n%5===0});if(n%5===0)await modal(page,'Page suivante')}
  await inputConversion(page,true);await modal(page,'Accueil');
  assert.deepEqual(await trophies(page),[],'14 bonnes conversions ne suffisent pas');
  await page.locator('[data-variant="sudden"]').click();
  for(let n=1;n<=40;n++){
   await inputConversion(page,false,{expectModal:n%5===0});
   const expected=[...(n>=15?['sudden-bronze']:[]),...(n>=25?['sudden-silver']:[]),...(n>=40?['sudden-gold']:[])];
   assert.deepEqual(await trophies(page),expected,'seuil exact à '+n+' conversions consécutives');
   if(n%5===0)await modal(page,'Page suivante');
  }
  await inputConversion(page,true);await modal(page,'Accueil');
  await page.reload();
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'3 / 6');
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'false');
  assert.equal(await page.locator('.record-trophies .earned').count(),3);
  assert.equal((await progress(page)).suddenBest,40);
  assert.deepEqual((await progress(page)).scoreRecords.medals,[]);
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
  assert.equal(await page.locator('#scoreHistory').textContent(),'129 pts');
  assert.equal(await page.locator('#abaque-demo-state').inputValue(),'signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  await page.goto(h.origin+'/apps/abaque-longueurs/?connect=1&class='+labClass+'#retour');
  await page.waitForURL(url=>url.pathname==='/apps/GRAN-abaque-m-1/'&&url.searchParams.get('connect')==='1'&&url.searchParams.get('class')===labClass&&url.hash==='#retour');
  assert.equal(await page.locator('#abaque-demo-state').count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Laboratoire : pas de doublon Abaque Connect, uniquement une démo hors ligne et le HUB Toutes',async()=>{
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
  await page.locator('#lab').waitFor({timeout:12000});
  assert.equal(await page.locator('#apps-title').textContent(),'Essais Connect — HUB « Toutes »');
  const hubLink=page.getByRole('link',{name:/Ouvrir Tests dans le HUB Toutes/});
  assert.equal(await hubLink.count(),1);
  const url=new URL(await hubLink.getAttribute('href'),h.origin);
  assert.equal(url.pathname,'/hub.html');assert.equal(url.searchParams.get('toutes'),'1');
  assert.equal(await page.locator('#abaque-pilot-controls [data-online-app="abaque-longueurs"]').count(),0);
  assert.equal(await page.locator('#apps [data-online-app="abaque-longueurs"]').count(),0);
  assert.equal(await page.locator('#abaque-pilot-controls').isVisible(),false);
  const demo=page.locator('#abaque-offline-demo');
  assert.equal(await demo.count(),1);
  assert.equal(new URL(await demo.getAttribute('href'),h.origin).searchParams.has('connect'),false);
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : opération de conversion et indicateurs hors du pavé fixe',async()=>{
 const h=await setup(),{page}=h;
 const thousand=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
 const geometry=async(ex,operation)=>ex.evaluate(el=>{
  const calc=el.querySelector('.t3Operation'),label=el.querySelector('.t3Direction');
  const operationBox=calc.getBoundingClientRect(),descriptionBox=calc.nextElementSibling.getBoundingClientRect();
  const marker=el.querySelector('.t3Movement marker path')?.getAttribute('fill');
  const probe=document.createElement('span');probe.style.color=marker;document.body.appendChild(probe);
  const expectedColor=getComputedStyle(probe).color;probe.remove();
  return {above:operationBox.bottom<=descriptionBox.top+1,
   sameColor:getComputedStyle(calc).color===expectedColor,
   withinSide:operationBox.right<=label.getBoundingClientRect().right+2,
   result:calc.textContent};
 });
 try{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(h.url);await fixture(page);
  for(const selector of ['[data-mode="one"]','[data-mode="three"]','[data-mode="five"]','[data-variant="sudden"]','[data-variant="lives"]']){
   await page.locator(selector).click();
   const ex=page.locator('.t3Ex').first();
   await ex.locator('.t3Open').click();
   if(await ex.locator('.t3HelpConfirm').isVisible())await ex.locator('.t3ConfirmOk').click();
   await ex.locator('.t3UnitsBtn').click();
   if(await ex.locator('.t3HelpConfirm').isVisible())await ex.locator('.t3ConfirmOk').click();
   const comma=ex.locator('.t3Comma');
   const initial=Number(await comma.getAttribute('aria-valuenow'));
   assert.equal(await ex.locator('.t3Operation').count(),0,'aucune opération à zéro déplacement');
   const target=initial>0?0:6;
   await comma.focus();await page.keyboard.press(initial>0?'Home':'End');
   const count=Math.abs(target-initial),op=(target<initial?'÷':'×')+' '+thousand(10**count);
   assert.equal(await ex.locator('.t3Operation').textContent(),op,selector);
   const rendered=await geometry(ex,op);
   assert.equal(rendered.above,true,selector+': opération au-dessus du déplacement');
   assert.equal(rendered.sameColor,true,selector+': couleur de la pointe de flèche');
   assert.equal(rendered.withinSide,true,selector+': opération dans sa colonne');
   await ex.locator('.t3Comma').focus();
   await page.keyboard.press(target===0?'ArrowRight':'ArrowLeft');
   const newCount=Math.abs(target+(target===0?1:-1)-initial);
   if(newCount===0)assert.equal(await ex.locator('.t3Operation').count(),0);
   else assert.equal(await ex.locator('.t3Operation').textContent(),(target<initial?'÷':'×')+' '+thousand(10**newCount),selector+': mise à jour immédiate au clavier');
   await page.locator('#homeBtn').click();
  }
  await page.locator('[data-mode="one"]').click();
  await page.evaluate(()=>{
   const progress=document.querySelector('#t3Progress');
   progress.classList.remove('hidden');progress.textContent='12/12 au premier essai';
  });
  for(const width of [1760,1440,1100,900,861,800,781]){
   await page.setViewportSize({width,height:900});
   const layout=await page.evaluate(()=>{
    const keypad=document.querySelector('#convertScreen .t3Keypad').getBoundingClientRect();
    const ids=['t3Progress','t3ScoreNow','t3ScoreBadge'];
    return {keypadLeft:keypad.left,indicators:ids.map(id=>{
     const rect=document.getElementById(id).getBoundingClientRect();
     return {id,right:rect.right,left:rect.left,top:rect.top,bottom:rect.bottom};
    })};
   });
   for(const item of layout.indicators)
    assert.ok(item.right<=layout.keypadLeft-6,
     width+'px: '+item.id+' doit rester à gauche du pavé');
  }
  for(const width of [780,660,390,320]){
   await page.setViewportSize({width,height:900});
   const mobile=await page.evaluate(()=>{
    const keypad=document.querySelector('#convertScreen .t3Keypad').getBoundingClientRect();
    const indicators=['t3Progress','t3ScoreNow','t3ScoreBadge'].map(id=>document.getElementById(id).getBoundingClientRect());
    return {bottomKeypad:keypad.top>innerHeight/2,
     topIndicators:indicators.every(r=>r.bottom<keypad.top),
     documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.ok(mobile.bottomKeypad&&mobile.topIndicators,width+'px: pavé au bas de la fenêtre');
   assert.ok(mobile.documentWidth<=mobile.viewport,width+'px: pas de défilement horizontal global');
  }
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque V3 : points des aides réellement affichés en classique, 3 vies et Mort subite',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await fixture(page);
  await page.locator('[data-mode="one"]').click();
  const items=page.locator('.t3Ex');
  await items.nth(2).locator('.t3UnitsBtn').click();
  await inputConversion(page);
  assert.equal(await page.locator('#t3ScoreNow').textContent(),'12 points','deux aides gratuites en 1 page');
  assert.match(await page.locator('#t3Summary').textContent(),/4\/4.*12 points/);
  await modal(page,'Accueil');

  for(const [variant,points] of [['lives',1],['sudden',2]]){
   await page.locator('[data-variant="'+variant+'"]').click();
   await page.locator('.t3Ex').first().locator('.t3Open').click();
   await page.locator('.t3Ex').first().locator('.t3ConfirmOk').click();
   await page.locator('.t3Ex').first().locator('.t3UnitsBtn').click();
   await page.locator('.t3Ex').first().locator('.t3ConfirmOk').click();
   await inputConversion(page,false,{expectModal:false});
   assert.equal(await page.locator('#t3ScoreNow').textContent(),points+' '+(points===1?'point':'points'));
   assert.equal(await page.locator('.t3Ex').nth(1).locator('.t3UnitsBtn').isDisabled(),true);
   await inputConversion(page,false,{expectModal:false});
   assert.equal(await page.locator('#t3ScoreNow').textContent(),(points+(variant==='lives'?3:6))+' points');
   await page.locator('#homeBtn').click();
  }
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque projection : grande fenêtre Oui/Non et envoi seulement après preuve confirmée',async()=>{
 const h=await setup(),{page}=h,requests=[];
 try{
  await page.route('**/functions/v1/connect-projection-v2',async route=>{
   requests.push(JSON.parse(route.request().postData()));
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,consentRecorded:true})});
  });
  await page.goto(h.url);
  await page.evaluate(async()=>{
   const {createAbaqueProjectionShare}=await import('./connect/projection-share.mjs');
   const cls='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
   const mock=()=>({version:2,eventId:crypto.randomUUID(),expectedResetEpoch:0,kind:'one',
    completed:true,master:false,units:[],images:[],
    tasks:Array.from({length:4},()=>({from:'m',to:'cm',source:2,answer:200,manip:false,units:false}))});
   window.__projectionMock=mock;
   window.__projectionTestStatus=document.querySelector('.demo-notice');
   window.__projectionShare=createAbaqueProjectionShare({classId:cls,base:'https://awmhpfofacaglewammxt.supabase.co',
    key:'public-test',appKey:'abaque-longueurs',token:async()=> 'fake-valid-token',
    identity:()=>({subject:'00000000-0000-4000-8000-000000000111',
     pupil:'00000000-0000-4000-8000-000000000222',sessionActive:true}),
    status:window.__projectionTestStatus});
   window.__projectionShare.offer(mock());
  });
  await page.locator('#abaque-projection-consent').waitFor({state:'visible'});
  assert.match(await page.locator('#abaque-projection-consent h2').textContent(),/Envoyer ton score au tableau/);
  const sizes=await page.locator('#abaque-projection-consent .abaque-share-choices button').evaluateAll(btns=>btns.map(b=>({
   width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,
   background:getComputedStyle(b).backgroundColor,font:getComputedStyle(b).fontWeight
  })));
  assert.equal(sizes.length,2);assert.deepEqual(sizes[0],sizes[1],'Oui et Non ont exactement la même présentation');
  assert.ok(sizes[0].height>=80);
  const dialog=await page.locator('#abaque-projection-consent').boundingBox();
  assert.ok(dialog.width>=600&&dialog.height>=350,'grande fenêtre visible');
  await page.locator('#abaque-share-no').click();
  assert.equal(await page.locator('#abaque-projection-consent').evaluate(el=>el.open),false);
  assert.equal(requests.length,0,'Non ne doit jamais appeler le serveur');
  await page.evaluate(()=>{
   window.__projectionEvent=window.__projectionMock();
   window.__projectionShare.offer(window.__projectionEvent);
  });
  await page.locator('#abaque-share-yes').click();
  assert.equal(requests.length,0,'Oui attend la confirmation Connect avant de publier');
  await page.evaluate(()=>window.__projectionShare.ack(window.__projectionEvent));
  await page.waitForFunction(()=>document.querySelector('.demo-notice')?.textContent?.includes('Score envoyé au tableau'));
  assert.equal(requests.length,1);
  assert.equal(requests[0].action,'student-share-score');
  assert.equal(requests[0].appKey,'abaque-longueurs');
  assert.equal(requests[0].eventId,await page.evaluate(()=>window.__projectionEvent.eventId));
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque activité 3 : pastilles du premier essai vert, bleu, mauve, rouge et anciennes parties neutres',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await fixture(page,{modes:{one:'red',three:'red',five:'red'},modeScores:{one:4,three:10,five:16}});
  for(const [mode,count] of [['one',4],['three',12],['five',20]]){
   const button=page.locator('.homeModeBtn[data-mode="'+mode+'"]');
   const dot=button.locator('.modeDots .modeDot');
   assert.equal(await dot.count(),count,'nombre de pastilles '+mode);
   assert.equal(await button.locator('.modeDots .modeDot.empty').count(),count,
    'anciennes séries sans détail ne doivent pas recevoir une fausse couleur');
  }
  // Une vraie série imparfaite remplace le résultat de référence d'une ancienne version.
  await fixture(page,{modes:{one:'red',three:'red',five:'red'}});
  await page.locator('[data-mode="one"]').click();
  await page.locator('.t3Ex').nth(2).locator('.t3UnitsBtn').click();
  await inputConversion(page,i=>i===3,{expectModal:false});
  await inputConversion(page,false);
  await modal(page,'Accueil');
  const button=page.locator('.homeModeBtn[data-mode="one"]');
  const details=await button.locator('.modeDots .modeDot').evaluateAll(xs=>xs.map(x=>x.classList[1]));
  assert.deepEqual(details,['green','green','purple','red']);
  assert.equal(await button.locator('.modeResult').textContent(),'3/4');
  assert.match(await button.locator('.modeDots').getAttribute('aria-label'),/sans aide/);
  assert.match(await button.locator('.modeDots').getAttribute('aria-label'),/unités/);

  // 12 et 20 résultats : quatre ronds par ligne, aucun résultat inventé.
  await page.evaluate(()=>{
   for(const [mode,total] of [['three',12],['five',20]]){
    const dots=Array.from({length:total},(_,i)=>['green','blue','purple','red'][i%4]);
    window.MATHAS_PROGRESS.recordMode(mode,total*3/4,total,dots);
   }
  });
  for(const [mode,count] of [['three',12],['five',20]]){
   const button=page.locator('.homeModeBtn[data-mode="'+mode+'"]');
   assert.equal(await button.locator('.modeDots .modeDot').count(),count);
   assert.equal(await button.locator('.modeDots .modeDot.blue').count(),count/4);
   assert.equal(await button.locator('.modeDots .modeDot.purple').count(),count/4);
  }
  await page.reload();
  assert.deepEqual(await page.locator('.homeModeBtn[data-mode="one"] .modeDot').evaluateAll(xs=>xs.map(x=>x.classList[1])),
   ['green','green','purple','red'],'les résultats demeurent après rechargement');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque Connect démarre même si le module facultatif du tableau ne se charge pas',async()=>{
 const cls='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 const subject='00000000-0000-4000-8000-000000000121',pupil='00000000-0000-4000-8000-000000000122';
 const snapshot={ok:true,status:'approved',ruleset:1,appKey:'abaque-longueurs',classId:cls,
  authSubject:subject,studentId:pupil,revision:0,resetEpoch:0,displayName:'Eleve test',
  state:{},trophies:[],activityAccess:{activity2:true,activity3:true,teacherFree:false,unlockMode:'all_open'},
  xp:{max:204,appXp:0,total:0,remaining:{build:20,moves:20,one:20,three:32,five:40,lives:72,sudden:72}}};
 const mockSdk=`export function createClient(){return {auth:{
  getSession:async()=>({data:{session:{access_token:'fake-token',user:{id:'${subject}'}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }}}`;
 const h=await setup(async route=>{
  const url=route.request().url();
  if(url.startsWith('https://esm.sh/@supabase/supabase-js@2.95.0')){
   await route.fulfill({status:200,contentType:'text/javascript',body:mockSdk});return true;
  }
  if(url.includes('/functions/v1/connect-abaque')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});return true;
  }
  if(url.includes('/functions/v1/connect-api')){
   await route.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return true;
  }
  return false;
 });
 try{
  const {page}=h;
  // Reproduit un fichier de projection filtré par le réseau de l'école.
  await page.route('**/apps/GRAN-abaque-m-1/connect/projection-share.mjs*',route=>route.abort('failed'));
  await page.goto(h.url+'?connect=1&class='+cls);
  await page.waitForFunction(()=>document.documentElement.dataset.abaqueConnected==='true');
  await page.locator('#launchBtn').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.abaquePending),undefined);
  assert.equal(await page.locator('#homeScreen').isVisible(),true);
  assert.equal(await page.locator('#launchBtn').evaluate(x=>x.inert),false);
  assert.equal(await page.locator('#homeConnectName').textContent(),'Eleve test');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.abaqueProjectionUnavailable),'true');
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('Abaque sans compte : scores et trophées locaux, deux réussites à 80 %, aucun XP ni publication',async()=>{
 const requests=[];
 const mockSdk=`export function createClient(){return {auth:{
  getSession:async()=>({data:{session:null}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }}}`;
 const h=await setup(async route=>{
  const url=route.request().url();
  if(url.startsWith('https://esm.sh/@supabase/supabase-js@2.95.0')){
   await route.fulfill({status:200,contentType:'text/javascript',body:mockSdk});return true;
  }
  if(url.includes('/functions/v1/')){requests.push(url);await route.abort();return true;}
  return false;
 });
 try{
  const {page}=h;
  await page.goto(h.url+'?connect=1&class='+labClass);
  await page.waitForFunction(()=>document.documentElement.dataset.abaqueGuest==='true');
  assert.equal(await page.locator('#homeScreen').isVisible(),true);
  assert.equal(await page.locator('#launchBtn').evaluate(x=>x.inert),false);
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'true');
  assert.equal(await page.locator('#masterToggle').isVisible(),false);
  assert.equal(await page.locator('#homeConnectAccount').isVisible(),false);
  assert.match(await page.locator('#abaque-connect-panel').textContent(),/sans connexion/);
  assert.match(await page.locator('#abaque-connect-panel').textContent(),/aucun XP/i);
  assert.equal(await page.evaluate(()=>window.MATHAS_PROGRESS.practice),false);
  for(let n=0;n<2;n++)await solveConstruction(page,{imperfect:true});
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'false',
   'deux séries de construction >=80 % débloquent l’activité 2 sans serveur');
  for(let n=0;n<2;n++)await solveMoves(page,{imperfect:true});
  assert.equal(await page.locator('[data-mode="one"]').getAttribute('aria-disabled'),'false',
   'deux séries de déplacements >=80 % débloquent l’activité 3 sans serveur');
  await page.evaluate(()=>window.MATHAS_PROGRESS.recordMode('one',2,4,['green','green','red','red']));
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'true',
   '2/4 est insuffisant pour débloquer 3 pages');
  await page.evaluate(()=>{
   window.MATHAS_PROGRESS.recordMode('one',3,4,['green','green','green','red']);
   window.MATHAS_PROGRESS.recordScore(45,'one');
  });
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'false',
   '3/4 ouvre 3 pages dès 75 %');
  await page.evaluate(()=>window.MATHAS_PROGRESS.recordMode('one',4,4,['green','green','green','green']));
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'false');
  // Les trophées s’acquièrent localement comme dans la démo, sans XP.
  await solveConstruction(page);
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');
  const guestKey='mathas.abaque.guest.'+labClass+'.v1';
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),guestKey);
  assert.equal(saved.modeScores.one,4);
  assert.equal(saved.scoreRecords.allBest,45);
  assert.ok(Array.isArray(JSON.parse(await page.evaluate(k=>localStorage.getItem(k+'.trophies'),guestKey))));
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.abaqueGuest==='true');
  assert.equal(await page.locator('[data-mode="three"]').getAttribute('aria-disabled'),'false');
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');
  assert.equal(await page.locator('#scoreHistory').textContent(),'45 pts');
  assert.deepEqual(requests,[],'aucune requête de score/XP/projection envoyée');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : compte identifié mais non autorisé ne bascule jamais dans le mode invité',async()=>{
 const subject='00000000-0000-4000-8000-000000000131';
 const mockSdk=`export function createClient(){return {auth:{
  getSession:async()=>({data:{session:{access_token:'fake-token',user:{id:'${subject}'}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }}}`;
 const h=await setup(async route=>{
  const url=route.request().url();
  if(url.startsWith('https://esm.sh/@supabase/supabase-js@2.95.0')){
   await route.fulfill({status:200,contentType:'text/javascript',body:mockSdk});return true;
  }
  if(url.includes('/functions/v1/connect-abaque')){
   await route.fulfill({status:403,contentType:'application/json',body:'{"ok":false,"error":"not_authorized"}'});return true;
  }
  return false;
 });
 try{
  await h.page.goto(h.url+'?connect=1&class='+labClass);
  await h.page.waitForFunction(()=>document.querySelector('#abaque-connect-panel')?.textContent?.includes('Connexion non disponible'));
  assert.equal(await h.page.evaluate(()=>document.documentElement.dataset.abaqueGuest),undefined);
  assert.equal(await h.page.evaluate(()=>document.documentElement.dataset.abaqueBlocked),'true');
  assert.equal(await h.page.locator('#launchBtn').evaluate(x=>x.closest('[inert]')!==null),true,
   'le verrou est appliqué au conteneur de la page, donc hérité par ses boutons');
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('Abaque : prof all_open ouvre activité 3, mais 3/4 puis 9/12 puis 15/20 restent obligatoires',async()=>{
 const subject='00000000-0000-4000-8000-000000000175';
 const pupil='00000000-0000-4000-8000-000000000176';
 const mockSdk=`export function createClient(){return {auth:{
  getSession:async()=>({data:{session:{access_token:'fake-token',user:{id:'${subject}'}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }}}`;
 const snapshot={ok:true,status:'approved',ruleset:1,appKey:'abaque-longueurs',classId:labClass,
  authSubject:subject,studentId:pupil,revision:0,resetEpoch:0,displayName:'Eleve 75',
  state:{},trophies:[],activityAccess:{activity2:true,activity3:true,teacherFree:false,unlockMode:'all_open'},
  xp:{max:204,appXp:0,total:0,remaining:{build:20,moves:20,one:20,three:32,five:40,lives:72,sudden:72}}};
 const h=await setup(async route=>{
  const url=route.request().url();
  if(url.startsWith('https://esm.sh/@supabase/supabase-js@2.95.0')){
   await route.fulfill({status:200,contentType:'text/javascript',body:mockSdk});return true;
  }
  if(url.includes('/functions/v1/connect-abaque')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});return true;
  }
  if(url.includes('/functions/v1/connect-api')){
   await route.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'});return true;
  }
  return false;
 });
 try{
  const {page}=h;
  await page.goto(h.url+'?connect=1&class='+labClass);
  await page.waitForFunction(()=>document.documentElement.dataset.abaqueConnected==='true');
  const btn=mode=>page.locator('#homeModeGrid [data-mode="'+mode+'"]');
  const permitted=async mode=>(await btn(mode).getAttribute('aria-disabled'))==='false';
  const records=async()=>(await page.locator('[data-variant="sudden"]').getAttribute('aria-disabled'))==='false';
  const setProgress=async(state,access=snapshot.activityAccess)=>page.evaluate(({snap,state,access})=>{
   window.MATHAS_PROGRESS.applyServer({...snap,state,activityAccess:access});
  },{snap:snapshot,state,access});
  assert.equal(await permitted('one'),true);
  assert.equal(await permitted('three'),false);
  assert.equal(await permitted('five'),false);
  assert.equal(await records(),false);
  assert.equal(await btn('one').locator('.modeResult').textContent(),'?/4');
  assert.equal(await btn('three').locator('.modeResult').textContent(),'?/12');
  assert.equal(await btn('five').locator('.modeResult').textContent(),'?/20');
  assert.equal(await btn('three').isVisible(),true);
  assert.equal(await btn('five').isVisible(),true);
  assert.match(await page.locator('#recordLock').textContent(),/75 %/);
  await setProgress({modeScores:{one:2}});
  assert.equal(await permitted('three'),false,'2/4 est insuffisant');
  await setProgress({modeScores:{one:3}});
  assert.equal(await permitted('three'),true,'3/4 ouvre les 3 pages');
  assert.equal(await permitted('five'),false);
  await setProgress({modeScores:{one:3,three:8}});
  assert.equal(await permitted('five'),false,'8/12 est insuffisant');
  await setProgress({modeScores:{one:3,three:9}});
  assert.equal(await permitted('five'),true,'9/12 ouvre les 5 pages');
  assert.equal(await records(),false);
  await setProgress({modeScores:{one:3,three:9,five:14}});
  assert.equal(await records(),false,'14/20 est insuffisant');
  await setProgress({modeScores:{one:3,three:9,five:15}});
  assert.equal(await records(),true,'15/20 ouvre les deux défis de score');
  assert.equal(await page.locator('[data-variant="lives"]').getAttribute('aria-disabled'),'false');

  await page.setViewportSize({width:1440,height:900});
  await btn('one').click();
  const input=page.locator('#convertScreen .t3Answer').first();
  await input.waitFor({state:'visible'});
  assert.ok((await input.boundingBox()).width>=150,'la case réponse mesure au moins 150 px sur PC');
  await page.setViewportSize({width:390,height:780});
  const bounds=await input.boundingBox();
  assert.ok(bounds.width>=135,'la réponse est suffisamment longue sur petit écran');
  assert.ok(bounds.x+bounds.width<=390+2,'la case ne déborde pas de l’écran');
  await page.locator('#homeBtn').click();

  await setProgress({modeScores:{one:4,three:12,five:20}},
   {activity2:true,activity3:false,teacherFree:false,unlockMode:'through_2'});
  assert.equal(await permitted('one'),false,'le professeur bloque toujours activité 3');
  assert.equal(await permitted('three'),false);
  assert.equal(await records(),false);
  assert.deepEqual(h.errors,[]);
  assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque V4 : aides indépendantes, gratuites sur 1 page, dans le bon ordre',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-mode="one"]').click();
  const all=page.locator('.t3Ex'),first=all.first();
  assert.equal(await all.count(),4);
  assert.equal(await all.locator('.t3Assistance:not(.hidden)').count(),0,'aucune aide imposée');
  const order=await first.evaluate(el=>{
   const a=el.querySelector('.t3HelpControls>.t3UnitsBtn').getBoundingClientRect();
   const b=el.querySelector('.t3HelpControls>.t3Open').getBoundingClientRect();
   return a.left<b.left;
  });assert.equal(order,true,'abaque à gauche, virgule à droite');
  assert.match(await first.locator('.t3UnitsBtn').textContent(),/Gratuit/);
  assert.match(await first.locator('.t3Open').textContent(),/Gratuit/);
  await first.locator('.t3UnitsBtn').click();
  assert.equal(await first.locator('.t3HelpConfirm:not(.hidden)').count(),0);
  assert.equal(await first.locator('.t3Abacus:not(.hidden)').count(),1);
  assert.equal(await first.locator('.t3BoardScroll.hidden').count(),1,'la manipulation reste fermée');
  await first.locator('.t3Open').click();
  assert.equal(await first.locator('.t3BoardScroll:not(.hidden)').count(),1);
  assert.equal(await first.locator('.t3Correspondences').count(),0);
  assert.equal(await first.locator('.t3Abacus .t3UnitLabel').count(),7);
  await inputConversion(page);
  assert.equal(await page.locator('#t3ScoreNow').textContent(),'12 points');
  assert.equal(await all.locator('.t3Assistance:not(.hidden)').count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque V4 : 3 pages abaque gratuit, manipulation payante, coupe sans aide',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-mode="three"]').click();
  const first=page.locator('.t3Ex').first();
  await first.locator('.t3UnitsBtn').click();
  assert.equal(await first.locator('.t3HelpConfirm:not(.hidden)').count(),0);
  assert.equal(await first.locator('.t3Abacus:not(.hidden)').count(),1);
  await first.locator('.t3Open').click();
  assert.match(await first.locator('.t3HelpConfirm').textContent(),/1 point de moins/);
  await first.locator('.t3ConfirmCancel').click();
  assert.equal(await first.locator('.t3BoardScroll.hidden').count(),1);
  await first.locator('.t3Open').click();
  await first.locator('.t3ConfirmOk').click();
  assert.equal(await first.locator('.t3BoardScroll:not(.hidden)').count(),1);
  await inputConversion(page);
  assert.equal(await page.locator('#t3ScoreNow').textContent(),'11 points');
  await modal(page,'Accueil');
  await page.evaluate(()=>{
   const progress=window.MATHAS_PROGRESS;
   progress.recordMode('one',4,4,Array(4).fill('blue'),true);
   progress.recordMode('three',12,12,Array(12).fill('green'),true);
   progress.recordMode('five',20,20,Array(20).fill('purple'),false);
  });
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'false');
  await page.evaluate(()=>window.MATHAS_PROGRESS.recordMode('five',20,20,Array(20).fill('green'),true));
  assert.equal(await page.locator('#trophy-convertLaunchCard').getAttribute('data-earned'),'true');
  await page.locator('[data-variant="sudden"]').click();
  await page.locator('.t3Ex').first().locator('.t3Open').click();
  assert.match(await page.locator('.t3Ex').first().locator('.t3HelpConfirm').textContent(),/2 points de moins/);
  await page.locator('.t3Ex').first().locator('.t3ConfirmCancel').click();
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque : arcs au-dessus des cases sans abaque et abaque statique, grandes flèches conservées mais masquées',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.locator('[data-mode="one"]').click();
  const ex=page.locator('.t3Ex').first();
  await ex.locator('.t3Open').click();
  const arcs=ex.locator('.t3Board > .t3Movement');
  assert.equal(await arcs.count(),1);
  assert.equal(await ex.locator('.t3Abacus:not(.hidden)').count(),0,'pas d’abaque automatique');
  assert.equal(await ex.locator('.t3Correspondences').count(),0,'pas de grandes correspondances');
  const comma=ex.locator('.t3Comma');
  const at=Number(await comma.getAttribute('aria-valuenow'));
  await comma.focus();
  await page.keyboard.press(at>0?'ArrowLeft':'ArrowRight');
  assert.equal(await arcs.locator('svg path[d^="M "]').count(),1,'un déplacement produit un arc');
  const placement=await ex.evaluate(node=>{
   const board=node.querySelector('.t3Board');
   const movement=board.querySelector(':scope > .t3Movement');
   const digits=board.querySelector('.t3Digits');
   const r=movement.getBoundingClientRect(),d=digits.getBoundingClientRect();
   return {above:r.bottom<=d.top+2,visible:r.width>200&&r.height>=30,svg:movement.querySelector('svg')!==null};
  });
  assert.deepEqual(placement,{above:true,visible:true,svg:true},'les petites flèches sont réellement au-dessus des cases');

  await ex.locator('.t3UnitsBtn').click();
  assert.equal(await ex.locator('.t3Abacus:not(.hidden)').count(),1);
  assert.equal(await ex.locator('.t3Abacus .t3Movement').count(),0,'aucun mouvement dans l’abaque');
  assert.equal(await ex.locator('.t3Correspondences').count(),0,'même après affichage, aucune grande flèche');
  const labels=ex.locator('.t3Abacus .t3UnitLabel');
  assert.equal(await labels.count(),7,'sept unités fixes');
  const before=await labels.evaluateAll(ns=>ns.map(n=>[n.textContent,n.className,n.getBoundingClientRect().x]));
  await ex.locator('.t3Comma').focus();
  await page.keyboard.press(at>0?'ArrowLeft':'ArrowRight');
  const after=await labels.evaluateAll(ns=>ns.map(n=>[n.textContent,n.className,n.getBoundingClientRect().x]));
  assert.deepEqual(after,before,'l’abaque ne change ni de place ni de surlignage');
  assert.equal(await arcs.locator('svg path[d^="M "]').count(),2,'les arcs continuent de suivre la virgule');
  assert.deepEqual(h.errors,[]);
  assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque activité 2 : × ou ÷ 10^n au-dessus des déplacements, même couleur que le point',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  await fixture(page);
  await page.locator('#moveLaunchBtn').click();
  const ex=page.locator('.moveEx').first();
  const rail=ex.locator('.moveRail');
  const op=ex.locator('.moveOperation');
  assert.equal(await op.count(),0,'pas de calcul à zéro déplacement');
  await rail.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await op.textContent(),'× 10');
  assert.equal(await ex.locator('.moveLineTop strong').textContent(),'1');
  await page.keyboard.press('ArrowRight');
  assert.equal(await op.textContent(),'× 100');
  assert.equal(await ex.locator('.moveLineTop strong').textContent(),'2');
  const positive=await ex.evaluate(node=>{
   const operation=node.querySelector('.moveOperation');
   const dot=node.querySelector('.moveDot > circle');
   const preview=document.createElement('i');preview.style.color=dot.getAttribute('fill');
   document.body.appendChild(preview);
   const equal=getComputedStyle(operation).color===getComputedStyle(preview).color;
   preview.remove();
   return {equal,vertical:operation.getBoundingClientRect().bottom<=node.querySelector('.moveLineTop strong').getBoundingClientRect().top+1};
  });
  assert.deepEqual(positive,{equal:true,vertical:true});
  for(let n=0;n<4;n++)await page.keyboard.press('ArrowRight');
  assert.equal(await op.textContent(),'× 1 000 000','l’affichage doit rester lisible pour six cases');
  await page.keyboard.press('Home');
  assert.equal(await op.count(),0,'revenir au centre masque le calcul');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await op.textContent(),'÷ 10');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await op.textContent(),'÷ 100');
  assert.equal(await op.getAttribute('aria-label'),'Diviser par 100');
  const negative=await ex.evaluate(node=>{
   const operation=node.querySelector('.moveOperation');
   const dot=node.querySelector('.moveDot > circle');
   const preview=document.createElement('i');preview.style.color=dot.getAttribute('fill');
   document.body.appendChild(preview);
   const equal=getComputedStyle(operation).color===getComputedStyle(preview).color;
   preview.remove();return equal;
  });
  assert.equal(negative,true);
  for(const width of [1440,1100,850,580,390,320]){
   await page.setViewportSize({width,height:900});
   const positions=await ex.evaluate(node=>{
    const result=node.querySelector('.moveOutcome').getBoundingClientRect();
    const operation=node.querySelector('.moveOperation').getBoundingClientRect();
    const label=node.querySelector('.moveLineTop strong').getBoundingClientRect();
    return {within:operation.left>=-2&&operation.right<=innerWidth+2,
     before:operation.bottom<=label.top+2, documentWidth:document.documentElement.scrollWidth};
   });
   assert.equal(positions.within,true,width+'px : opération contenue dans le viewport');
   assert.equal(positions.before,true,width+'px : opération au-dessus du nombre');
   assert.ok(positions.documentWidth<=width,width+'px : pas de défilement horizontal');
  }
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});

test('Abaque activité 3 : plateau aligné à gauche et abaque élargi, arcs et score inchangés',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-mode="one"]').click();
  const ex=page.locator('.t3Ex').first();
  await ex.locator('.t3UnitsBtn').click();
  await ex.locator('.t3Open').click();
  const zone=ex.locator('.t3AbacusZone');
  const scroll=ex.locator('.t3BoardScroll');
  const board=ex.locator('.t3Board');
  const labels=ex.locator('.t3UnitLabel');
  const desktop=await ex.evaluate(node=>{
   const zone=node.querySelector('.t3AbacusZone').getBoundingClientRect();
   const scroll=node.querySelector('.t3BoardScroll').getBoundingClientRect();
   const board=node.querySelector('.t3Board').getBoundingClientRect();
   return {abacusWidth:zone.width,boardOffset:board.left-scroll.left,
    order:zone.right<=board.left+2,scrollLeft:scroll.left,abacusLeft:zone.left};
  });
  assert.ok(desktop.abacusWidth>=260,'l’abaque élargi occupe au moins 260 px sur ordinateur : '+JSON.stringify(desktop));
  assert.ok(desktop.boardOffset>=-2&&desktop.boardOffset<=20,'cases de manipulation alignées à gauche');
  assert.equal(desktop.order,true,'abaque à gauche des cases sans chevauchement');
  const before=await board.boundingBox();
  assert.equal(await labels.count(),7);
  const abacus=await ex.locator('.t3Abacus').boundingBox();
  assert.ok(abacus.width>=260,'les sept unités bénéficient de la largeur accrue');
  const labelSize=await labels.first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(labelSize>=12,'étiquettes de l’abaque suffisamment lisibles');
  const comma=ex.locator('.t3Comma'),at=Number(await comma.getAttribute('aria-valuenow'));
  await comma.focus();await page.keyboard.press(at>0?'ArrowLeft':'ArrowRight');
  assert.ok(await ex.locator('.t3Board > .t3Movement.active svg path[d^="M "]').count()>=1,
   'les flèches de manipulation restent au-dessus des cases');
  assert.equal(await ex.locator('.t3Correspondences').count(),0,'aucune grosse flèche de guidage');
  for(const width of [1341,1100,900,780,760,390,320]){
   await page.setViewportSize({width,height:900});
   const layout=await ex.evaluate(node=>{
    const rect=node.querySelector('.t3AbacusZone').getBoundingClientRect();
    const screen=document.documentElement;
    return {width:rect.width,within:rect.left>=-1&&rect.right<=innerWidth+2,
     bodyWidth:screen.scrollWidth};
   });
   assert.equal(layout.within,true,width+'px : abaque dans la page');
   assert.ok(layout.bodyWidth<=width,width+'px : aucun défilement horizontal global');
   assert.ok(layout.width>=Math.min(width<761?270:215,width-45),width+'px : abaque agrandi');
  }
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});
