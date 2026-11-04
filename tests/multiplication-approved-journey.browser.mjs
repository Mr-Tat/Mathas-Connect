// Vraie entrée enfant/hôte/jeu V7.0.0. Les endpoints Supabase Auth, XP et
// preuves sont simulés à la frontière HTTP ; AUCUN JWT hébergé n'est testé.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const CLS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const AUTH='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
const files={
 '/apps/multiplication-simple/':['../apps/multiplication-simple/index.html','text/html'],
 '/apps/multiplication-simple/index.html':['../apps/multiplication-simple/index.html','text/html'],
 '/apps/multiplication-simple/game-original.html':['../apps/multiplication-simple/game-original.html','text/html'],
 '/apps/multiplication-simple/school-ui.mjs':['../apps/multiplication-simple/school-ui.mjs','text/javascript'],
 '/apps/multiplication-simple/certified-classic.mjs':['../apps/multiplication-simple/certified-classic.mjs','text/javascript'],
 '/apps/multiplication-simple/school-record-eligibility.mjs':['../apps/multiplication-simple/school-record-eligibility.mjs','text/javascript'],
 '/apps/objective-record/native-connect-bridge.mjs':['../apps/objective-record/native-connect-bridge.mjs','text/javascript'],
 '/projection-consent.mjs':['../projection-consent.mjs','text/javascript']
};
const server=createServer((req,res)=>{
 const entry=files[(req.url||'').split('?')[0]];
 if(!entry){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':entry[1]+'; charset=utf-8'});
 res.end(readFileSync(new URL(entry[0],import.meta.url)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});

async function connectedPage(teacher=false){
 const page=await browser.newPage({viewport:{width:390,height:820}});
 const calls=[],proofCalls=[];
 let state=null;
 let xp={ok:true,milestones:[],repeatXp:false,parcours:1,total:0,appXp:0,level:1};
 const context={get state(){return state},get xp(){return xp},calls,proofCalls,page};
 await page.route('https://esm.sh/**',async route=>{
  const session={user:{id:AUTH,is_anonymous:!teacher},access_token:'jwt-fixture-only'};
  const js='export function createClient(){return {auth:{getSession:async()=>({data:{session:'+JSON.stringify(session)+'}})}}}';
  await route.fulfill({status:200,contentType:'application/javascript',body:js});
 });
 await page.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/**',async route=>{
  const url=route.request().url();
  const b=route.request().postDataJSON();
  calls.push({url:url.split('/').at(-1),action:b?.action});
  let response={ok:false,error:'unexpected_action'},status=200;
  if(url.endsWith('/connect-api')){
   assert.equal(b.action,teacher?'teacher-player':'student-me');
   response={ok:true,status:'approved',classId:CLS,displayName:teacher?'Monsieur T · TEST':'Élève fictif · TEST'};
  }else if(url.endsWith('/connect-results')){
   if(b.action==='student-load')
    response={ok:true,revision:state?1:0,resetEpoch:0,state,multiplierLock:[9]};
   else if(b.action==='student-xp')response=xp;
  }else if(url.endsWith('/connect-multiplication-school')){
   proofCalls.push(b);
   if(b.action==='start-classic-v1'){
    response={ok:true,sessionId:EVENT,revision:0,resetEpoch:0,level:1,total:4,
     expiresAt:new Date(Date.now()+3600000).toISOString(),
     questions:Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'mul',a:'249',m:9,width:3}))};
   }else if(b.action==='finish-classic-v1'){
    assert.equal(b.answers.length,4);
    state={classic:[{'4':4},{},{}],sudden:[0,0,0],hard:[0,0,0],
     progress:{},recent:[{eventId:EVENT,mode:'classic',level:1,score:4,total:4,
      points:16,at:new Date().toISOString()}],
     bestPoints:16,todayBest:{day:day(),points:16},topThree:[16],
     rewards:{version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
      sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
       silver:[false,false,false],gold:[false,false,false]},
      scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false}};
    xp={...xp,appXp:22,total:22,milestones:['classic:1:4:perfect']};
    response={ok:true,proofVerified:true,verifiedScore:4,duplicate:false,state,
     xp:{delta:22,appXp:22,total:22,level:1}};
   }
  }else if(url.endsWith('/connect-projection-v2')){
   // Aucune soumission ne doit avoir lieu sans clic explicite « Oui ».
   throw Error('Projection unexpectedly posted in browser smoke test');
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
 });
 page.on('pageerror',error=>{context.error=String(error.message)});
 const suffix='?class='+CLS+(teacher?'&joueur=prof':'');
 await page.goto(origin+'/apps/multiplication-simple/'+suffix,{waitUntil:'domcontentloaded'});
 await page.locator('iframe').waitFor({state:'attached',timeout:18000});
 await page.frameLocator('iframe').locator('#menuScreen').waitFor({state:'attached'});
 return context;
}

async function playFour(page){
 const frame=page.frameLocator('iframe');
 await frame.locator('.classic-count-btn[data-count="4"]').click({timeout:12000});
 const proof=page.locator('#mathasMultiCertified:not([hidden])');
 await proof.waitFor({timeout:12000});
 for(let i=0;i<4;i++){
  for(const [col,digit] of [[0,'1'],[1,'4'],[2,'2'],[3,'2']]){
   await proof.locator('.mul-proof-input.answer[data-col="'+col+'"]').fill(digit);
  }
  await proof.getByRole('button',{name:'Vérifier ce calcul'}).click();
  if(i<3)await proof.getByRole('button',{name:'Calcul suivant'}).click();
 }
 await proof.getByText('Score vérifié par le serveur.',{exact:false}).waitFor({timeout:14000});
}

try{
 await test('TEST student: native button -> challenge -> server receipt -> XP & reload',async()=>{
  const {page,proofCalls,calls}=await connectedPage();
  try{
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
   const frame=page.frameLocator('iframe');
   assert.equal(await frame.locator('#menuScreen .classic-count-btn[data-count="4"]').count(),1);
   await playFour(page);
   assert.deepEqual(proofCalls.map(x=>x.action),['start-classic-v1','finish-classic-v1']);
   assert.ok(calls.some(x=>x.action==='student-xp'));
   await page.waitForFunction(()=>
     document.getElementById('xp-earned-total')?.textContent?.includes('22'),null,{timeout:11000});
   await page.locator('#mathasMultiCertified button').first().click().catch(()=>{});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.frameLocator('iframe').locator('#mathasPointsQuick [data-points="daily"]')
    .waitFor({timeout:20000});
   const score=await page.frameLocator('iframe').locator('#mathasPointsQuick [data-points="daily"]').innerText();
   assert.match(score,/16/,'native Top du jour reads certified 16 points after reloading');
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
  }finally{await page.close()}
 });
 await test('Monsieur T: teacher JWT scope uses the same school-certified multiplication entry',async()=>{
  const {page,proofCalls,calls}=await connectedPage(true);
  try{
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
   assert.ok(calls.some(x=>x.action==='teacher-player'));
   await page.frameLocator('iframe').locator('.classic-count-btn[data-count="4"]').click();
   await page.locator('#mathasMultiCertified:not([hidden])').waitFor();
   assert.equal(proofCalls[0].action,'start-classic-v1');
  }finally{await page.close()}
 });
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
