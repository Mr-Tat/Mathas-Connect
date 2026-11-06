// Regression: a native end-card shortcut must issue a NEW authenticated
// Connect challenge. Synthetic .click() never counts as a school launch.
// Entirely fake JWT / Edge responses, never connects to any real student.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const PUPIL='11111111-1111-4111-8111-111111111111';
const AUTH='22222222-2222-4222-8222-222222222222';
const IDS=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const REWARDS={version:3,mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};

test('End menu cannot bypass school proof: confirmation before overlay, then 4 -> 10 issues a new session',async()=>{
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const bytes=await readFile(file);
   res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8',
    '.mjs':'text/javascript','.js':'text/javascript','.css':'text/css',
    '.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  const actions=[],errors=[];
  let issued=0,received=0,finishRequested=0,allowFinish;
  const ready=new Promise(resolve=>{allowFinish=resolve});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2.95.0*',route=>route.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"test",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
  }));
  await page.route('**/*.supabase.co/**',async route=>{
   const body=route.request().postDataJSON()??{};
   actions.push(body);
   let response;
   if(route.request().url().includes('/connect-api'))
    response={ok:true,status:'approved',classId:CLASS};
   else if(route.request().url().includes('/connect-results'))
    response=body.action==='student-load'
     ?{ok:true,revision:received,resetEpoch:0,
       state:{rewards:REWARDS,classic:[received?{'4':4}: {},{},{}]},
       storageSubject:PUPIL}
     :{ok:true,appXp:received*22,total:received*22,level:1,max:120,milestones:[],
       currentMilestones:[],parcours:1,repeatXp:false};
   else if(route.request().url().includes('/connect-projection-v2'))
    response={ok:true,events:[],bestThree:[],todayBest:null,boardBest:999};
   else if(route.request().url().includes('/connect-objective-record-school')){
    if(body.action==='start-proof-v2'){
     assert.equal(body.level,1);
     assert.equal(body.total,issued===0?4:10);
     response={ok:true,sessionId:IDS[issued],revision:issued,resetEpoch:0,
      level:1,total:body.total,
      questions:Array.from({length:body.total},(_,i)=>({id:'q'+(i+1),op:'add',a:123,b:456})),
      expiresAt:'2090-12-31T23:59:59Z'};
     issued++;
    }else if(body.action==='finish-proof-v2'){
     finishRequested++;
     assert.equal(body.sessionId,IDS[0]);
     assert.equal(body.answers.length,4);
     await ready; // Intentionally block receipt to expose overlap/race.
     received++;
     response={ok:true,proofVerified:true,verifiedScore:4,revision:1,resetEpoch:0,
      xp:{appXp:22,total:22,level:1,delta:22}};
    }else throw Error('Unexpected school action '+body.action);
   }else throw Error('Unexpected endpoint '+route.request().url());
   await route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+
   '/apps/objective-record/eleve.html?class='+CLASS+'&app=addition-simple',
   {waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:30000});
  const native=page.frameLocator('#gameFrame').frameLocator('#game');
  await native.locator('.classic-count-btn[data-count="4"]').click();
  await page.waitForFunction(()=>{
   const w=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentWindow;
   return w?.__mathasServerCertified?.questions?.length===4&&
    w.__mathasSchoolProofState?.phase==='playing';
  },null,{timeout:18000});
  await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   const q=w.__mathasServerCertified.questions;
   for(const row of q)w.MathasCertifiedAttempt({id:row.id,digits:['9','7','5'],carries:['','','']});
   // Native end normally fires this event through updateBar. The keyboard
   // path itself is covered by the companion real-keyboard browser suite.
   w.MathasLabV2Update({phase:'ended',mode:'classic',level:1,total:4,score:4,completed:4});
   w.document.getElementById('menuScreen').classList.add('hidden');
   w.document.getElementById('gameScreen').classList.remove('hidden');
   w.document.getElementById('primaryBtn').textContent='Retour au menu';
  });
  await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Connect')||
   document.getElementById('status')?.textContent.includes('Vérif'),null,{timeout:10000});
  await page.waitForTimeout(1600);
  assert.equal(finishRequested,1,'exactly one official finalization request');
  assert.equal(await native.locator('.mathas-post-activity-overlay').count(),0,
   'no navigation overlay until ACK, even when the native end button is shown');
  assert.equal(await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   return w.__mathasSchoolProofState?.phase;
  }),'saving');
  allowFinish();
  await page.waitForFunction(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   return w.__mathasSchoolProofState?.phase==='verified';
  },null,{timeout:15000});
  await native.locator('.mathas-post-activity-overlay').waitFor({state:'visible',timeout:14000});
  assert.match(await native.locator('.mathas-post-activity-summary').textContent(),/confirmé par Connect/i);
  await native.locator('.mathas-post-activity-btn.follow').filter({hasText:'Passer à 10 calculs'}).click();
  await page.waitForFunction(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   return w.__mathasServerCertified?.questions?.length===10&&
    w.__mathasServerCertified?.sessionId==='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  },null,{timeout:20000});
  assert.equal(issued,2,'shortcut must issue second proof through server');
  assert.equal(actions.filter(x=>x.action==='game-record').length,0);
  assert.deepEqual(errors,[]);
 }finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
