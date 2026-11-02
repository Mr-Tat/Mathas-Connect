import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const key='mathas_connect_abaque_demo_progress_v1';
const trophyKey='mathas_connect_abaque_demo_trophies_v1';
const units=['km','hm','dam','m','dm','cm','mm'];
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
 return {page,origin,url:origin+'/apps/abaque-longueurs/',errors,external,
  close:async()=>{await browser.close();await new Promise(done=>server.close(done));}};
}
const modal=(page,label)=>page.locator('#celebrateActions').getByRole('button',{name:label,exact:true}).click();
const progress=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const trophies=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),trophyKey);

async function inputConversion(page,wrong=false,{expectModal=true}={}){
 const articles=page.locator('.t3Ex');
 const count=await articles.count();assert.ok(count>0);
 for(let i=0;i<count;i++){
  const article=articles.nth(i),input=article.locator('input.t3Answer');
  if(await input.isDisabled())continue;
  const expression=await article.locator('.t3Expression').innerText();
  const match=expression.match(/([\d\s]+)\s*(km|hm|dam|m|dm|cm|mm)\s*=[\s\S]*?(km|hm|dam|m|dm|cm|mm)\s*$/);
  assert.ok(match,expression);
  const shift=units.indexOf(match[3])-units.indexOf(match[2]);
  const source=Number(match[1].replace(/\s/g,''));
  const incorrect=typeof wrong==='function'?wrong(i):wrong;
  const value=incorrect?0:shift>=0?source*10**shift:source/10**(-shift);
  await input.click();await page.keyboard.press('Delete');await page.keyboard.type(String(value));
 }
 await page.locator('#t3Verify').click();
 assert.equal(await page.locator('#celebrateDialog').evaluate(el=>el.open),expectModal,
  await page.locator('#t3Summary').textContent());
}

// Fixtures supply unlocks, never perfect results: gold must come from actual play.
async function fixture(page,state={}){
 const saved={stage1:{passes:['orange','orange'],passScores:[10,10]},
  stage2:{passes:['orange','orange'],passScores:[7,7]},
  modes:{one:'orange',three:'orange',five:'orange'},...state};
 await page.evaluate(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key,saved});
 await page.reload();
}
async function enterMaster(page){
 await page.locator('#masterToggle').click();
 await page.locator('#masterPassword').fill('Thecakeisalie');
 await page.locator('#masterForm button[type="submit"]').click();
}
async function solveConstruction(page,{imperfect=false,started=false}={}){
 if(!started)await page.locator('#launchBtn').click();
 for(const unit of ['km','m','cm','mm']){
  const column=imperfect&&unit==='km'?'m':imperfect&&unit==='m'?'km':unit;
  await page.locator(`#unitBank [data-id="${unit}"]`).click();
  await page.locator(`#abaque .col[data-unit="${column}"]`).click();
 }
 await page.locator('#verifyBtn').click();
 if(imperfect){
  assert.match(await page.locator('#feedback').textContent(),/2 unités/);
  await page.locator('#abaque [data-type="unit"][data-id="km"]').click();
  await page.locator('#abaque .col[data-unit="km"]').click();
  await page.locator('#verifyBtn').click();
 }
 const items=await page.locator('#imagesBank [data-id]').evaluateAll(els=>els.map(el=>({
  id:el.dataset.id,unit:window.MATHAS_ITEMS.find(item=>item.id===el.dataset.id).unit
 })));
 assert.equal(items.length,8);
 for(const item of items){
  await page.locator(`#imagesBank [data-id="${item.id}"]`).click();
  await page.locator(`#abaque .col[data-unit="${item.unit}"]`).click();
 }
 await page.locator('#verifyBtn').click();await modal(page,'Accueil');
}
async function solveMoves(page,{imperfect=false,started=false}={}){
 if(!started)await page.locator('#moveLaunchBtn').click();
 for(let part=0;part<2;part++){
  for(let i=0;i<4;i++){
   const rail=page.locator('.moveRail').nth(i);
   const match=(await rail.getAttribute('aria-label')).match(/de (\w+) vers (\w+)/);
   const shift=imperfect&&part===0&&i===0?0:units.indexOf(match[2])-units.indexOf(match[1]);
   await rail.focus();
   for(let step=0;step<Math.abs(shift);step++)await page.keyboard.press(shift>0?'ArrowRight':'ArrowLeft');
  }
  await page.locator('#verifyMoves').click();
  if(part===0&&imperfect)await page.locator('#moveNew').click();
  else await modal(page,part===0?'Page suivante':'Accueil');
 }
}

test('Abaque : premiers essais 10/12 et 7/8, déblocages, puis trophées parfaits après les deux réussites',async()=>{
 const h=await setup(),{page}=h;
 try{
  await page.goto(h.url);
  assert.equal(await page.locator('.trophy-hint').count(),3);
  assert.equal(await page.locator('.trophy-hint.earned').count(),0);
  assert.equal(await page.locator('#personalBest').textContent(),'0');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'0 / 3');
  assert.deepEqual(await page.locator('.trophy-hint').allTextContents(),['','','']);
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
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'2 / 3');
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
   const bounds=await page.locator('.trophy-hint').evaluateAll(els=>els.map(el=>{
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
  await preview.waitFor();assert.equal(await preview.getAttribute('href'),'https://mr-tat.github.io/Mathas-Connect/apps/abaque-longueurs/');
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
  assert.equal(await page.locator('.trophy-hint.earned').count(),3);
  await page.evaluate(()=>window.MATHAS_PROGRESS.reset());await page.reload();
  assert.equal(await page.locator('.trophy-hint.earned').count(),3);
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
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'0 / 3');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').evaluate(el=>getComputedStyle(el).fontWeight),'400');
  await solveConstruction(page);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true','une activité reste jouable dans le profil fictif');
  await choice.selectOption('collected');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'3 / 3');
  assert.equal(await page.locator('#personalBest').textContent(),'580');
  assert.equal(await page.locator('.collection-trophy.earned').count(),3);
  assert.deepEqual(await page.locator('.abaque-demo-xp').allTextContents(),Array(7).fill('Reste 0 XP'));
  assert.equal(await page.locator('#recordChoice .record-caption .abaque-xp-remaining').count(),0);
  assert.deepEqual(await page.locator('.trophy-hint').allTextContents(),['','','']);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('title'),'Architecte de l’abaque — obtenu');
  for(const width of [1440,768,320]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'simulation sans débordement à '+width);
  }
  await page.screenshot({path:resolve(tmpdir(),'abaque-demo-scenarios-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:resolve(tmpdir(),'abaque-demo-scenarios-desktop.png'),fullPage:true});
  await choice.selectOption('signed-out');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.equal(await page.locator('#personalBest').textContent(),'129');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'1 / 3');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),initial,'aucun faux résultat, XP ou trophée enregistré');
  await choice.selectOption('collected');await page.reload();
  assert.equal(await choice.inputValue(),'signed-out','pas de fausse connexion conservée au rechargement');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
