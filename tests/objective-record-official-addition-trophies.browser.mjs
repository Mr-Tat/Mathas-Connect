import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const klass='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const pupil='11111111-1111-4111-8111-111111111111';
const auth='22222222-2222-4222-8222-222222222222';
function rewards(mastery){
 return {version:3,mastery:{'4':[mastery,false,false],
   '10':[mastery,false,false],'20':[mastery,false,false]},
  sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
   silver:[false,false,false],gold:[false,false,false]},
  scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
}
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8',
    '.mjs':'text/javascript','.js':'text/javascript','.css':'text/css',
    '.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
for(const [slug,levelWidth] of [['addition-simple','3'],['addition-multiple','5']]){
 test('Chromium official trophies '+slug+': awarded, reset, unavailable, never local demo',async()=>{
  const {server,url}=await serve();let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1340,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let serverRewards=rewards(true),scoreShareWrites=0;
   const todayEvent={eventId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    mode:'classic',score:4,points:20,total:4,at:new Date().toISOString()};
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"x",user:{id:"'+auth+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+auth+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()??{};let data;
    if(r.request().url().includes('/connect-api'))data={ok:true,status:'approved',classId:klass};
    else if(r.request().url().includes('/connect-results'))
     data=b.action==='student-load'
      ?{ok:true,revision:0,resetEpoch:0,storageSubject:pupil,state:{rewards:serverRewards===null?rewards(false):serverRewards}}
      :{ok:true,appXp:0,total:0,level:1};
    else if(r.request().url().includes('/connect-projection-v2')&&b.action==='student-score-history')
     data={ok:true,events:[todayEvent],bestThree:[todayEvent],todayBest:todayEvent,boardBest:0};
    else if(r.request().url().includes('/connect-projection-v2')&&b.action==='student-share-score'){
     scoreShareWrites++;
     assert.equal(b.eventId,todayEvent.eventId,'Seule la preuve certifiée correspondante est envoyée');
     data={ok:true,consentRecorded:true};
    }
    else throw Error('unexpected server call '+b.action);
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+klass+'&app='+slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,
    null,{timeout:45000});
   // Les coupes officielles restent dans les cases du jeu ; leur ancien
   // compteur textuel est volontairement retiré du panneau XP.
   assert.equal(await page.locator('#trophies').count(),0);
   const officialTrophies=()=>page.evaluate(()=>{
    const r=window.MathasConnectOfficialTrophies?.rewards;
    if(!r)return null;
    return Object.values(r.mastery).flat().filter(Boolean).length+
     Object.values(r.hardAwards).flat().filter(Boolean).length+
     r.sudden.filter(Boolean).length+Object.values(r.scoreOne).filter(Boolean).length+
     Number(r.unlockedGold);
   });
   assert.equal(await officialTrophies(),3,'three genuine server-approved trophies');
   // Le récapitulatif récent ajouté en doublon ne doit plus masquer les
   // 2 éléments d'origine : meilleur score du jour et podium des records.
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.querySelector('#mathasPointsQuick .mathas-points-quick-item--best.mathas-school-shareable')
     &&!!doc?.getElementById('mathasPointsDetail');
   },null,{timeout:15000});
   const cards=await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const top=doc.getElementById('mathasPointsQuick'),history=doc.getElementById('mathasPointsDetail');
    return {top:getComputedStyle(top).display!=='none'&&top.getBoundingClientRect().height>0,
     history:getComputedStyle(history).display!=='none'&&history.getBoundingClientRect().height>0,
     originalPodium:!!history.querySelector('.mathas-v541-podium'),
     originalTrophies:!!doc.getElementById('mathasTrophiesStrip'),
     extra:!!doc.getElementById('mathasSchoolScoreHistory')||!!doc.getElementById('mathasSchoolScoreTop'),
     role:top.querySelector('.mathas-points-quick-item--best')?.getAttribute('role')};
   });
   assert.equal(cards.top,true,'Meilleur score du jour visible');
   assert.equal(cards.history,true,'Records historiques visibles');
   assert.equal(cards.originalPodium,true,'Coupes historiques conservées');
   assert.equal(cards.originalTrophies,true,'Coupes de progression conservées');
   assert.equal(cards.extra,false,'Aucun nouveau cadre Connect en doublon');
   assert.equal(cards.role,'button','Le score du jour est activable au clavier');
   const discreet=await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const score=doc.querySelector('#mathasPointsQuick .mathas-points-quick-item--best');
    const share=score.querySelector('.mathas-school-share-hint');
    const strip=doc.getElementById('mathasTrophiesStrip');
    const challenge=strip.querySelector('.mathas-trophies-hint');
    return {
     shareText:share?.textContent,
     sharePointer:getComputedStyle(share).pointerEvents,
     shareBorder:getComputedStyle(share).borderTopWidth,
     shareHeight:share.getBoundingClientRect().height,
     shareWidth:share.getBoundingClientRect().width,
     shareArrow:getComputedStyle(share,'::after').content,
     shareArrowGap:getComputedStyle(share,'::after').marginLeft,
     clickArea:score.getBoundingClientRect().width,
     trophyText:challenge?.textContent?.trim(),
     trophyBorder:getComputedStyle(challenge).borderTopWidth,
     trophyPointer:getComputedStyle(challenge).pointerEvents,
     stripTag:strip.tagName
    };
   });
   assert.equal(discreet.shareText,'Proposer ce score à la projection');
   assert.equal(discreet.sharePointer,'none','l encadré partage la zone clic du TOP DU JOUR');
   assert.equal(discreet.shareBorder,'1px');
   assert.ok(discreet.shareHeight<35,'contour de projection discret');
   assert.ok(discreet.clickArea>150,'la carte complète reste la zone cliquable');
   assert.ok(discreet.shareWidth<=discreet.clickArea-70,
    'le cadre de projection ne doit pas s étirer jusque sous les coupes : '+JSON.stringify(discreet));
   assert.match(discreet.shareArrow,/›/,'flèche à la fin de la proposition');
   assert.equal(discreet.shareArrowGap,'7px','flèche espacée du texte');
   assert.equal(discreet.trophyText,'Voir les défis');
   assert.equal(discreet.trophyBorder,'1px');
   assert.equal(discreet.trophyPointer,'none','le bouton reste la bande de trophées entière');
   assert.equal(discreet.stripTag,'BUTTON');
   const clickTop=score=>page.evaluate(points=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const top=doc.querySelector('#mathasPointsQuick .mathas-points-quick-item--best');
    top.querySelector('[data-points="daily"]').innerHTML='<span>'+String(points)+'</span><span class="mathas-points-record">RECORD</span>';
    top.click();
   },score);
   await clickTop(12);
   await page.waitForTimeout(200);
   assert.equal(await page.locator('.mathas-projection-offer:not([hidden])').count(),0,
    'Un chiffre local différent du résultat certifié ne peut pas être proposé');
   assert.equal(scoreShareWrites,0);
   await clickTop(20);
   await page.locator('.mathas-projection-offer button.yes').waitFor({state:'visible'});
   assert.equal(scoreShareWrites,0,'Le clic ne partage pas le score sans Oui');
   await page.locator('.mathas-projection-offer button').first().click();
   assert.equal(scoreShareWrites,0,'Refuser laisse le score privé');
   await clickTop(20);
   await page.locator('.mathas-projection-offer button.yes').waitFor({state:'visible'});
   const posted=page.waitForResponse(res=>res.url().includes('/connect-projection-v2')
    &&res.request().postDataJSON()?.action==='student-share-score');
   await page.locator('.mathas-projection-offer button.yes').click();
   await posted;
   assert.equal(scoreShareWrites,1,'La confirmation publie exactement une preuve officielle');

   await page.evaluate(width=>{
    const native=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const select=native.getElementById('classicMaxDigits');
    select.value=width;select.dispatchEvent(new Event('change',{bubbles:true}));
   },levelWidth);
   const cup=()=>page.evaluate(()=>{
    const native=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    return native.querySelector('.mlab-mastery-under-series .mlab-cup')?.getAttribute('aria-label')??'';
   });
   await page.waitForFunction(()=>{
    const native=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return native?.querySelector('.mlab-mastery-under-series .mlab-cup')?.getAttribute('aria-label')?.includes('obtenu');
   },null,{timeout:12000});
   assert.match(await cup(),/obtenu/);

   // Native localStorage claims the pupil won NOTHING; official achievement
   // still wins because the Connect profile is the only authority.
   await page.evaluate(()=>{
    const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    const allFalse={
     mastery:{4:[false,false,false],10:[false,false,false],20:[false,false,false]},
     sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
      silver:[false,false,false],gold:[false,false,false]},
     scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false
    };
    if(w.MathasPoints)w.MathasPoints.readTrophies=()=>allFalse;
   });
   await page.waitForTimeout(1000);
   assert.match(await cup(),/obtenu/,'local game cannot remove permanent trophies');

   // The authentic REST profile changes, so the native display follows it.
   serverRewards=rewards(false);
   await page.frameLocator('#gameFrame').frameLocator('#game')
    .locator('#mathas-native-connect-xp').click();
   await page.locator('#refresh').click();
   await page.waitForFunction(()=>window.MathasConnectOfficialTrophies?.rewards
     ?.mastery?.['4']?.[0]===false,null,{timeout:12000});
   assert.equal(await officialTrophies(),0);
   await page.waitForTimeout(1000);
   assert.match(await cup(),/à gagner/);

   // SQL NULL from the verified trophy registry means no earned trophies.
   // Connect exposes a complete 25-false snapshot in that case.
   serverRewards=null;await page.locator('#refresh').click();
   await page.waitForFunction(()=>window.MathasConnectOfficialTrophies?.rewards
     ?.mastery?.['4']?.[0]===false,null,{timeout:12000});
   assert.equal(await officialTrophies(),0);
   await page.waitForTimeout(950);
   assert.match(await cup(),/à gagner/,'new pupils still see unearned trophies');
   await page.setViewportSize({width:390,height:780});
   await page.waitForTimeout(1000);
   assert.equal(await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    const el=doc?.querySelector('.mlab-mastery-under-series .mlab-cup');
    return !!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0;
   }),true,'trophy visible on a phone-width viewport');

   // A malformed non-null server response still fails closed.
   serverRewards={unavailable:true};await page.locator('#refresh').click();
   await page.waitForFunction(()=>window.MathasConnectOfficialTrophies?.active===true
    &&window.MathasConnectOfficialTrophies.rewards===null,null,{timeout:12000});
   assert.equal(await officialTrophies(),null);
   await page.waitForFunction(()=>{
    const native=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return native?.documentElement.classList.contains('mathas-connect-official-trophies-unavailable');
   },null,{timeout:10000});
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
 });
}
