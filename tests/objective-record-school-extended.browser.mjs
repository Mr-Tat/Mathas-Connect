// Browser E2E using a fake authenticated school account ONLY. No real
// student JWT, no production writes, actual DOM/keyboard and BigInt columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {expectedExtendedWidth} from '../apps/objective-record/certified-extended.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const PUPIL='11111111-1111-4111-8111-111111111111';
const AUTH='22222222-2222-4222-8222-222222222222';
const SESSION='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REWARDS={version:3,mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
const examples=[
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'sudden',level:1,wrong:1},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'hard-three-lives',level:3,wrong:3}
];
for(const item of examples){
 test('school browser certified '+item.slug+' '+item.mode+' early stop, score, XP, projected consent',async()=>{
  const server=createServer(async(req,res)=>{
   const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
   if(!path.startsWith(root+sep)){res.writeHead(403).end();return}
   try{const bytes=await readFile(path);
    res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.png':'image/png','.webp':'image/webp'})[extname(path)]||'application/octet-stream'}).end(bytes)
   }catch{res.writeHead(404).end()}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port;let browser;
  const width=expectedExtendedWidth(item.app,item.mode,item.level);
  const terms=item.app==='addition-ecrite-simple'?2:item.level===3?7:6;
  const number='9'.repeat(width);
  const questions=Array.from({length:120},(_,i)=>({id:'q'+(i+1),op:'add',width,
   addends:Array(terms).fill(number)}));
  const actions=[],errors=[];let recordUnlocked=item.slug!=='addition-simple';
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1160,height:820}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({status:200,contentType:'text/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()||{};actions.push(b);
    const part=r.request().url();let ack;
    if(part.includes('/connect-api'))ack={ok:true,status:'approved',classId:CLASS};
    else if(part.includes('/connect-results'))ack=b.action==='student-load'?
     {ok:true,revision:0,resetEpoch:0,state:{rewards:REWARDS,progress:recordUnlocked?{level2:true,level3:true,sudden1:true,sudden2:true,sudden3:true,perfect1:true,perfect2:true,perfect3:true,hard:true}:{},hard:[3,3,0]},storageSubject:PUPIL}:
     {ok:true,appXp:0,total:0,level:1,milestones:[],currentMilestones:[],
      parcours:1,repeatXp:false};
    else if(part.includes('/connect-objective-record-school')){
     if(b.action==='start-extended-proof-v1'){
      assert.equal(b.mode,item.mode);assert.equal(b.level,item.level);
      ack={ok:true,sessionId:SESSION,questions,mode:item.mode,level:item.level,width,
       limit:120,revision:0,resetEpoch:0,expiresAt:'2090-12-31T23:59:59Z'};
     }else if(b.action==='finish-extended-proof-v1'){
      assert.equal(b.answers.length,item.wrong);
      assert.ok(b.answers.every(a=>a.digits.every(x=>x==='0')));
      assert.ok(b.answers.every((a,i)=>a.id==='q'+(i+1)));
      ack={ok:true,proofVerified:true,verifiedScore:0,mode:item.mode,attempted:item.wrong,
       revision:1,resetEpoch:0,xp:{delta:0,appXp:0,total:0,level:1}};
     }else throw Error('unexpected extended action '+b.action);
    }else throw Error('unhandled endpoint '+part);
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(ack)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:45000});
   assert.equal(await page.locator('#connect-bar').isVisible(),true,'barre réservée au profil approuvé');
   await page.waitForFunction(()=>document.getElementById('connect-bar').classList.contains('retracted'),
    null,{timeout:8500});
   assert.equal(await page.locator('#bar-handle').isVisible(),true,'poignée de rappel');
   await page.locator('#bar-handle').click();
   assert.equal(await page.locator('#connect-bar').isVisible(),true);
   await page.waitForFunction(()=>{
    const inner=document.getElementById('gameFrame')?.contentDocument?.getElementById('game');
    const link=inner?.contentDocument?.getElementById('mathas-game-hub-return');
    return !!link&&link.getAttribute('href')?.includes('/hub.html?class=');
   },null,{timeout:16000});
   // Visual contract: a verified pupil never sees the LAB's duplicate
   // "Reste XP" simulation; only one small official badge per native button.
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.querySelector('.classic-count-btn[data-count="10"] .mathas-connect-official-xp');
   },null,{timeout:16000});
   const schoolLayout=await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const classic=doc.querySelector('.classic-count-btn[data-count="10"]');
    const badge=classic.querySelector('.mathas-connect-official-xp');
    const red=doc.querySelector('#startSudden');
    const b=badge.getBoundingClientRect(),r=classic.getBoundingClientRect();
    return {
     fake:doc.querySelectorAll('.classic-xp-remaining,.score-mode-detail,.mathas-pilot-remaining').length,
     badges:classic.querySelectorAll('.mathas-connect-official-xp').length,
     badgePosition:doc.defaultView.getComputedStyle(badge).position,
     bottom:r.bottom-b.bottom,
     right:r.right-b.right,
     redName:red.querySelector('.score-mode-name')?.textContent?.trim(),
     redText:red.textContent,
     hardLocked:doc.documentElement.classList.contains('mathas-school-hard-locked'),
     hardLevel3Locked:doc.documentElement.classList.contains('mathas-school-hard3-locked')
    };
   });
   assert.equal(schoolLayout.fake,0,'no fake XP line from the LAB preview');
   assert.equal(schoolLayout.badges,1,'one official XP badge per classic button');
   assert.equal(schoolLayout.badgePosition,'absolute','XP belongs to the bottom-right corner');
   assert.ok(schoolLayout.bottom>=-1&&schoolLayout.bottom<=18,JSON.stringify(schoolLayout));
   assert.ok(schoolLayout.right>=-1&&schoolLayout.right<=18,JSON.stringify(schoolLayout));
   assert.equal(schoolLayout.redName,'Mort subite');
   assert.doesNotMatch(schoolLayout.redText,/Lancer la mort subite/i);
   assert.equal(schoolLayout.hardLocked,item.slug==='addition-simple',
    'HARD hidden until official progression has unlocked it');
   // Opening the custom Niveau selector must place its portal BELOW the
   // button, never in the header or above the window.
   const nativeMenu=page.frameLocator('#gameFrame').frameLocator('#game');
   await nativeMenu.locator('#menuScreen .slide-select-button').first().click();
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    const menu=doc?.querySelector('.slide-select-menu.mathas-dropdown-portal');
    const button=doc?.querySelector('#menuScreen .slide-select-wrap.open .slide-select-button');
    if(!menu||!button)return false;
    return menu.getBoundingClientRect().top>=button.getBoundingClientRect().bottom;
   },null,{timeout:12000});
   await nativeMenu.locator('#menuScreen .slide-select-button').first().click();

   if(item.slug==='addition-simple'){
    // A new approved pupil cannot launch either Objectif record mode.
    await page.waitForFunction(()=>{
     const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return doc?.getElementById('startSudden')?.disabled===true &&
      doc?.getElementById('startThreeLives')?.disabled===true &&
      doc?.getElementById('mathas-school-record-lock')?.hidden===false;
    },null,{timeout:16000});
    // The same pupil unlocks both modes after a server-verified 8/10.
    // Simulate only the official student-load reply, NEVER a local browser score.
    recordUnlocked=true;
    await page.evaluate(()=>document.getElementById('refresh').click());
    await page.waitForFunction(()=>{
     const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return doc?.getElementById('startSudden')?.disabled===false &&
      doc?.getElementById('startThreeLives')?.disabled===false;
    },null,{timeout:16000});
    // A real click on the familiar Mort subite card must issue a school proof;
    // no separate hidden "Défi Connect" action is necessary.
    const native=page.frameLocator('#gameFrame').frameLocator('#game');
    await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const level=doc.getElementById('suddenMaxDigits');level.value='3';
     level.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await native.locator('#startSudden .mathas-connect-official-xp').waitFor({state:'visible',timeout:15000});
    assert.match(await native.locator('#startSudden').textContent(),/Reste 20 XP/);
    await native.locator('#startSudden').click();
    assert.equal(await page.locator('#certified-mode').inputValue(),'sudden');
   }else{
    await page.locator('#challenge-toggle').click();
    await page.locator('#certify:not([disabled])').waitFor({state:'visible',timeout:10000});
    await page.locator('#certified-mode').selectOption(item.mode);
    await page.locator('#certified-level').selectOption(String(item.level));
    await page.locator('#certify').click();
   }
   await page.locator('#extended-certified:not([hidden])').waitFor({state:'visible',timeout:15000});
   for(let i=0;i<item.wrong;i++){
    const fields=page.locator('#extended-grid input.answer');
    const n=await fields.count();assert.ok(n>=width);
    for(let j=0;j<n;j++)await fields.nth(j).fill('0');
    await page.locator('#extended-verify').click();
    if(i<item.wrong-1)await page.locator('#extended-next').click();
   }
   await page.waitForFunction(()=>document.getElementById('status').textContent.includes('XP officiels'),
    null,{timeout:18000});
   assert.equal(actions.filter(a=>a.action==='finish-extended-proof-v1').length,1);
   assert.equal(actions.filter(a=>a.action==='game-record').length,0);
   // Switching straight from a finished extended mode to the other addition
   // must never leave the shared certified start button disabled.
   const other=item.slug==='addition-simple'?'addition-multiple':'addition-simple';
   await page.locator('#challenge-toggle').click();
   await page.locator('#app').selectOption(other);
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,
    null,{timeout:35000});
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
 });
}
