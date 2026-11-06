import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const classId='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const pupil='11111111-1111-4111-8111-111111111111';
const authId='22222222-2222-4222-8222-222222222222';
const sessionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const questions=[
 {id:'q1',op:'add',a:123,b:456},
 {id:'q2',op:'add',a:789,b:111},
 {id:'q3',op:'add',a:509,b:382},
 {id:'q4',op:'add',a:999,b:101}
];
const rewards={version:3,
 mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],
 hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
async function launchServer(){
 const server=createServer(async(req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  const file=resolve(root,'.'+p);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
   const bytes=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript',
    '.js':'text/javascript','.json':'application/json','.css':'text/css',
    '.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Chromium: 4 vraies additions émises par Connect, écritures natives et ACK XP issu du serveur',async()=>{
 const {server,url}=await launchServer();
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  const exceptions=[],requests=[];let xp=0;
  page.on('pageerror',e=>exceptions.push(e.message));
  await page.route('**/supabase-js@2.95.0*',route=>route.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"test-token",user:{id:"'+authId+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+authId+'",is_anonymous:true}},error:null})}}}'
  }));
  await page.route('**/*.supabase.co/**',async route=>{
   const request=route.request();
   const b=request.postDataJSON()??{};requests.push(b);
   let response;
   if(request.url().includes('/connect-api')){
    response={ok:true,status:'approved',classId};
   }else if(request.url().includes('/connect-results')){
    response=b.action==='student-load'?
     {ok:true,revision:xp?1:0,resetEpoch:0,state:{rewards},storageSubject:pupil}:
     {ok:true,appXp:xp,total:xp,level:1,milestones:xp?['classic:1:4:perfect']:[],
       currentMilestones:[],parcours:1,repeatXp:false};
   }else if(request.url().includes('/connect-projection-v2')){
    if(b.action==='student-score-history'){
     const recorded=xp>0?{eventId:sessionId,mode:'classic',score:4,total:4,points:22,at:new Date().toISOString()}:null;
     response={ok:true,events:recorded?[recorded]:[],bestThree:recorded?[recorded]:[],
      todayBest:recorded,boardBest:0};
    }else response={ok:true,consentRecorded:true};
   }else if(request.url().includes('/connect-objective-record-test')){
    if(b.action==='start-proof-v2'){
     assert.equal(b.level,1);assert.equal(b.total,4);
     response={ok:true,sessionId,questions,revision:0,resetEpoch:0,level:1,total:4,
      expiresAt:'2090-12-31T23:59:59Z'};
    }else if(b.action==='finish-proof-v2'){
     assert.equal(b.sessionId,sessionId);
     assert.deepEqual(b.answers.map(x=>x.id),['q1','q2','q3','q4']);
     assert.equal(b.answers.length,4);
     xp=22;
     response={ok:true,revision:1,resetEpoch:0,proofVerified:true,
      verifiedScore:4,xp:{appXp:22,total:22,level:1,delta:22}};
    }else throw Error('unknown_action '+b.action);
   }else throw Error('unexpected Supabase path '+request.url());
   await route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  await page.goto(url+'/apps/objective-record/eleve.html?class='+classId+'&app=addition-simple',
   {waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>!document.getElementById('certify').disabled,{timeout:45000});
  // A regular student earns official XP through the familiar native menu.
  const native=page.frameLocator('#gameFrame').frameLocator('#game');
  // The genuine game hides its base <select> under a custom level picker.
  // Set the underlying choice, then click the VISIBLE native series button.
  await page.evaluate(()=>{
   const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
   const level=doc.getElementById('classicMaxDigits');level.value='3';
   level.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await native.locator('.classic-count-btn[data-count="4"] .mathas-connect-official-xp')
   .waitFor({state:'visible',timeout:18000});
  assert.match(await native.locator('.classic-count-btn[data-count="4"]').textContent(),/Reste 22 XP/);
  await native.locator('.classic-count-btn[data-count="4"]').click();
  try{await page.waitForFunction(()=>{
   const w=document.getElementById('gameFrame')?.contentDocument
    ?.getElementById('game')?.contentWindow;
   return w?.__mathasServerCertified?.index===2 &&
    w?.document?.getElementById('gameScreen')?.classList.contains('hidden')===false;
  },null,{timeout:25000});}
  catch(error){
   const debug=await page.evaluate(()=>{
    const outer=document.getElementById('gameFrame');
    const frame=outer?.contentDocument?.getElementById('game');
    const doc=frame?.contentDocument;
    const win=frame?.contentWindow;
    return {outerStatus:outer?.contentDocument?.getElementById('state')?.textContent,
     status:document.getElementById('status')?.textContent,
     isGameLoaded:!!doc,menu:doc?.getElementById('menuScreen')?.className,
     game:doc?.getElementById('gameScreen')?.className,
     cert:win?.__mathasServerCertified,inlineErrors:win?.__mathasLabError||null};
   });
   throw Error('native-cert-timeout '+JSON.stringify({debug,exceptions,actions:requests.map(x=>x.action)})+' '+error);
  }
  const issued=await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   return {issued:w.__mathasServerCertified.questions.map(q=>[q.a,q.b]),
    text:w.document.querySelector('#calculationsPair')?.innerText||''};
  });
  assert.deepEqual(issued.issued,questions.map(q=>[q.a,q.b]));
  assert.ok(issued.text.split(/\s+/).join('').includes('123'));
  assert.ok(issued.text.split(/\s+/).join('').includes('456'));
  await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   for(const q of w.__mathasServerCertified.questions){
    const sum=q.a+q.b;
    const digits=String(sum).split('').reverse();
    const carries=['',...([1,2].map(i=>
      (q.a%(10**i))+(q.b%(10**i))>=10**i?'1':''))];
    w.MathasCertifiedAttempt({id:q.id,digits,carries});
   }
   w.MathasLabV2Update({phase:'ended',mode:'classic',level:1,score:0,total:4,completed:4});
  });
  await page.waitForFunction(()=>document.getElementById('status')?.textContent
   .includes('Vérifié côté serveur'),null,{timeout:25000});
  assert.equal(xp,22);
  assert.equal(requests.filter(x=>x.action==='finish-proof-v2').length,1);
  assert.equal(requests.filter(x=>x.action==='game-record').length,0);
  assert.equal(requests.filter(x=>x.action==='student-share-score').length,0,
   'un XP confirmé ne publie pas automatiquement le score');
  await page.locator('.mathas-projection-offer button.yes').waitFor({state:'visible'});
  const shared=page.waitForRequest(r=>r.url().includes('connect-projection-v2')&&
   r.postDataJSON()?.action==='student-share-score');
  await page.locator('.mathas-projection-offer button.yes').click();
  const share=await shared;
  assert.equal(share.postDataJSON().eventId,sessionId);
  assert.equal(share.postDataJSON().appKey,'addition-ecrite-simple');
  assert.equal(share.postDataJSON().classId,classId);
  assert.deepEqual(exceptions,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});

for(const {level,total} of [{level:2,total:10},{level:3,total:20}]){
 test('Chromium: native Addition simple certified level '+level+' / '+total+' questions',async()=>{
  const {server,url}=await launchServer();
  let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1360,height:900}});
   const requests=[],errors=[];let awarded=0;
   const width=({1:3,2:5,3:7})[level],base=10**(width-1);
   const qs=Array.from({length:total},(_,i)=>({
    id:'q'+(i+1),op:'add',a:base+i,b:base+100+i
   }));
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+authId+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+authId+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()??{};requests.push(b);
    let result;
    if(r.request().url().includes('connect-api')){
     result={ok:true,status:'approved',classId};
    }else if(r.request().url().includes('connect-results')){
     result=b.action==='student-load'?
      {ok:true,revision:awarded?1:0,resetEpoch:0,
        state:{rewards,classic:[{'10':8},{'10':8},{}],progress:{level2:true,level3:true}},
        storageSubject:pupil}:
      {ok:true,appXp:awarded,total:awarded,level:1};
    }else if(r.request().url().includes('/connect-projection-v2')){
     result={ok:true,events:[],bestThree:[],todayBest:null,boardBest:0};
    }else if(b.action==='start-proof-v2'){
     assert.equal(b.level,level);assert.equal(b.total,total);
     result={ok:true,sessionId,questions:qs,revision:0,resetEpoch:0,level,total,
      expiresAt:'2090-12-31T23:59:59Z'};
    }else if(b.action==='finish-proof-v2'){
     assert.equal(b.answers.length,total);
     assert.deepEqual(b.answers.map(x=>x.id),qs.map(x=>x.id));
     for(const ans of b.answers)assert.equal(ans.carries.length,width);
     awarded=total===10?36:60;
     result={ok:true,revision:1,resetEpoch:0,proofVerified:true,
      verifiedScore:total,xp:{appXp:awarded,total:awarded,level:1,delta:awarded}};
    }else throw Error('unknown mocked call '+JSON.stringify(b));
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+classId+'&app=addition-simple',
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,{timeout:45000});
   // Le sélecteur de niveau appartient au vrai menu natif, sans Défi Connect.
   await page.evaluate((width)=>{
    const doc=document.getElementById('gameFrame').contentDocument
     .getElementById('game').contentDocument;
    const select=doc.getElementById('classicMaxDigits');
    select.value=String(width);
    select.dispatchEvent(new Event('change',{bubbles:true}));
   },width);
   await page.frameLocator('#gameFrame').frameLocator('#game')
    .locator('.classic-count-btn[data-count="'+total+'"]').click();
   await page.waitForFunction(()=>document.getElementById('gameFrame')?.contentDocument
    ?.getElementById('game')?.contentWindow?.__mathasServerCertified?.index===2,null,{timeout:30000});
   const status=await page.evaluate(()=>{
    const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    return {level:w.__mathasServerCertified.level,total:w.__mathasServerCertified.total,
     pairs:w.document.querySelectorAll('#calculationsPair .calc-box').length,
     screen:w.document.getElementById('gameScreen').classList.contains('hidden'),
     text:w.document.getElementById('calculationsPair').innerText.replace(/\s+/g,'')};
   });
   assert.equal(status.level,level);assert.equal(status.total,total);assert.equal(status.pairs,2);
   assert.equal(status.screen,false);assert.ok(status.text.includes(String(base)));
   await page.evaluate(()=>{
    const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    for(const q of w.__mathasServerCertified.questions){
     const sum=q.a+q.b,width=String(q.a).length;
     w.MathasCertifiedAttempt({id:q.id,digits:String(sum).split('').reverse(),
      carries:['',...Array.from({length:width-1},(_,j)=>{
       const power=10**(j+1);
       return (q.a%power)+(q.b%power)>=power?'1':'';
      })]});
    }
    w.MathasLabV2Update({phase:'ended',mode:'classic',
     level:w.__mathasServerCertified.level,total:w.__mathasServerCertified.total,
     completed:w.__mathasServerCertified.total});
   });
   await page.waitForFunction(()=>document.getElementById('status')?.textContent
    .includes('Vérifié côté serveur'),null,{timeout:25000});
   assert.equal(requests.filter(x=>x.action==='finish-proof-v2').length,1);
   assert.equal(requests.filter(x=>x.action==='game-record').length,0);
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
 });
}
